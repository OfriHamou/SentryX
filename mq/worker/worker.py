import os
import json
import time
import logging
from typing import Dict, Any
import redis
from psycopg2 import pool
from contextlib import contextmanager
import concurrent.futures

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Config
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = os.getenv("QUEUE_NAME", "event-processing")
WAIT_LIST_KEY = f"bull:{QUEUE_NAME}:wait"
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 1))


DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "sentryx")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


# Redis Client
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# Postgres Connection Pool (Using ThreadedConnectionPool for multi-threaded worker)
try:
    pg_pool = pool.ThreadedConnectionPool(
        1,
        MAX_WORKERS,
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    if pg_pool:
        logger.info("Connection pool created successfully")
except Exception as e:
    logger.error(f"Error creating connection pool: {e}")
    raise


@contextmanager
def get_db_connection():
    """Context manager to ensure connections are returned to the pool."""
    conn = pg_pool.getconn()
    try:
        yield conn
    finally:
        pg_pool.putconn(conn)


def get_job_key(job_id: str) -> str:
    """Returns the Redis key for a specific BullMQ job."""
    return f"bull:{QUEUE_NAME}:{job_id}"


def run_ai_analysis(image_path: str) -> Dict[str, Any]:
    """Simulates a heavy AI processing task."""
    logger.info(f"Running AI analysis on {image_path}...")
    time.sleep(2)  # Simulate processing time
    # Dummy result
    return {"faces_detected": 1, "confidence": 0.95, "labels": ["person"]}


def process_job(job_id: str):
    """Fetches job data from BullMQ hash and processes it."""
    job_key = get_job_key(job_id)
    job_data_str = redis_client.hget(job_key, "data")
    attempts_made = int(redis_client.hget(job_key, "attemptsMade")) or "UNKNOWN"

    if not job_data_str:
        logger.warning(f"No data found for job ID: {job_id}")
        return False

    event_id = None
    try:
        job_data = json.loads(job_data_str)
        event_id = job_data.get("eventId")
        if not event_id:
            logger.error(
                f"eventId missing in job data for job {job_id}. Attempts made so far: {attempts_made}"
            )
            return False

        logger.info(
            f"Processing event: {event_id} (Job: {job_id}, Attempt: {attempts_made})"
        )

        # Connect to DB
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Set status to PROCESSING
                cursor.execute(
                    "UPDATE events SET status = %s WHERE id = %s",
                    ("PROCESSING", event_id),
                )
                conn.commit()

                # Query image path
                cursor.execute(
                    "SELECT image_path FROM events WHERE id = %s", (event_id,)
                )
                row = cursor.fetchone()

                if not row:
                    logger.error(f"Event {event_id} not found in database.")
                    cursor.execute(
                        "UPDATE events SET status = %s WHERE id = %s",
                        ("failure", event_id),
                    )
                    conn.commit()
                    return False

                image_path = row[0]

                # Run AI logic
                metadata = run_ai_analysis(image_path=image_path)

                # Update event
                cursor.execute(
                    """
                    UPDATE events 
                    SET status = %s, ai_metadata = %s 
                    WHERE id = %s
                    """,
                    ("COMPLETED", json.dumps(metadata), event_id),
                )
                conn.commit()
                logger.info(
                    f"Successfully processed event {event_id}. Status updated to completed."
                )
                return True

    except json.JSONDecodeError:
        logger.error(f"Invalid JSON data for job {job_id}: {job_data_str}")
        return False
    except Exception as e:
        logger.error(f"Error processing job {job_id}: {e}")
        # Update database with failure status if we exception out
        if event_id:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "UPDATE events SET status = %s WHERE id = %s",
                            ("FAILURE", event_id),
                        )
                        conn.commit()
            except Exception as db_e:
                logger.error(
                    f"Error updating failure status for event {event_id}: {db_e}"
                )
        return False


def handle_job(job_id: str):
    """Handles an individual job, including process_job and retry logic."""
    job_key = get_job_key(job_id)

    try:
        # Increment BEFORE processing to know we started working on it
        attempts = redis_client.hincrby(job_key, "attemptsMade", 1)

        success = process_job(job_id)
        if not success:
            if attempts <= 3:
                logger.warning(
                    f"Job {job_id} failed. Re-inserting to wait queue (Attempt {attempts}/3)"
                )
                # LPUSH re-inserts it to the backlog
                redis_client.lpush(WAIT_LIST_KEY, job_id)
                time.sleep(1)
            else:
                logger.error(
                    f"Job {job_id} permanently failed after 3 attempts. Moving to 'failed' state."
                )
                timestamp = int(time.time() * 1000)
                # Add job to BullMQ failed sorted set so BullMQ (and UIs like BullMQ board) can see it as failed
                redis_client.zadd(f"bull:{QUEUE_NAME}:failed", {job_id: timestamp})
                redis_client.hset(
                    job_key,
                    "failedReason",
                    "Max attempts reached or unrecoverable error.",
                )
    except Exception as e:
        logger.error(f"Error handling job {job_id} in thread: {e}")


def main():
    logger.info(f"Started BullMQ Python Worker with {MAX_WORKERS} threads.")

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        while True:
            try:
                # BullMQ adds job IDs to the wait list. We block and wait for one.
                # RPOP because BullMQ pushes to the left (LPUSH) for wait list
                result = redis_client.brpop(WAIT_LIST_KEY, timeout=5)
                if result:
                    _, job_id = result
                    # Submit job to the thread pool for parallel processing
                    executor.submit(handle_job, job_id)
            except Exception as e:
                logger.error(f"Error while polling queue: {e}")
                time.sleep(1)


if __name__ == "__main__":
    main()
