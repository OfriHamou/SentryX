import typing
from dataclasses import dataclass
import os
import json
import time
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any
import redis
from psycopg2 import pool
from contextlib import contextmanager
import concurrent.futures
from google import genai
from google.genai import types
from PIL import Image

# Initialize the Gemini Client
ai_client = genai.Client()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Config
REDIS_HOST = os.getenv("REDIS_URL", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE_NAME = os.getenv("QUEUE_NAME", "event-processing")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
WAIT_LIST_KEY = f"bull:{QUEUE_NAME}:wait"
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 1))

MAXIMUM_TASK_FAIL_COUNT = int(os.getenv("MAX_FAIL_COUNT", 3))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "sentryx")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

MEDIA_LOCATION = os.getenv("FRAMES_SAVE_LOCATION", "/tmp/sentryx/media/events/")

logger.info("Worker configured purely for REMOTE AI processing via Gemini API.")

# Initialize Clients
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)


@dataclass(frozen=True)
class ProcessingResponse:
    success: bool
    fatal: typing.Optional[bool] = None


@contextmanager
def get_db_connection():
    """Context manager to ensure connections are returned to the pool."""
    # Postgres Connection Pool
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

    conn = pg_pool.getconn()
    try:
        yield conn
    finally:
        pg_pool.putconn(conn)


def get_job_key(job_id: str) -> str:
    """Returns the Redis key for a specific BullMQ job."""
    return f"bull:{QUEUE_NAME}:{job_id}"


# =========================================================================
# Custom Exceptions
# =========================================================================
class QuotaExceededError(Exception):
    def __init__(self, sleep_seconds: int):
        self.sleep_seconds = sleep_seconds
        super().__init__(f"API Quota/Rate Limit Exceeded. Sleeping for {sleep_seconds}s.")


# =========================================================================
# AI Core Execution Layers
# =========================================================================

def analyze_frame_remotely(image_path: str) -> Dict[str, Any]:
    """Sends the local image frame to Google Gemini's API."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file to upload not found: {image_path}")

    img = Image.open(image_path)
    prompt = (
        "Analyze this surveillance image frame. Identify every individual person visible and extract metadata. "
        "Pay attention to safety compliance (masks, helmets, vests), clothing characteristics, physical traits, and mood."
    )

    try:
        response = ai_client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=[img, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "people_count": types.Schema(type=types.Type.INTEGER),
                        "individuals": types.Schema(
                            type=types.Type.ARRAY,
                            items=types.Schema(
                                type=types.Type.OBJECT,
                                properties={
                                    "apparent_gender": types.Schema(type=types.Type.STRING),
                                    "estimated_age_group": types.Schema(type=types.Type.STRING,
                                                                        description="Child, Teenager, Young Adult, Middle Aged, Senior"),
                                    "apparent_age_years": types.Schema(type=types.Type.INTEGER,
                                                                       description="Best numerical estimate of the person's age in years"),
                                    "skin_tone_description": types.Schema(type=types.Type.STRING,
                                                                          description="Visual description of skin tone or complexion group for identification"),
                                    "face_covering": types.Schema(type=types.Type.BOOLEAN),
                                    "face_covering_type": types.Schema(type=types.Type.STRING),
                                    "headwear": types.Schema(type=types.Type.STRING),
                                    "safety_vest_worn": types.Schema(type=types.Type.BOOLEAN),
                                    "clothing_upper_color": types.Schema(type=types.Type.STRING),
                                    "facial_expression": types.Schema(type=types.Type.STRING),
                                    "posture_state": types.Schema(type=types.Type.STRING),
                                },
                                required=[
                                    "apparent_gender",
                                    "estimated_age_group",
                                    "apparent_age_years",
                                    "skin_tone_description",
                                    "face_covering",
                                    "clothing_upper_color",
                                    "facial_expression",
                                    "posture_state"
                                ]
                            )
                        )
                    },
                    required=["people_count", "individuals"]
                ),
            ),
        )
        result_metadata = json.loads(response.text)
        result_metadata["engine"] = "gemini_security_v2"
        return result_metadata

    except Exception as e:
        error_msg = str(e).lower()
        # Catch typical quota, rate limit, and 429 exhaustion keywords
        if any(keyword in error_msg for keyword in ["429", "quota", "rate limit", "resource exhausted"]):
            # Attempt to parse seconds from the error string, fallback to 60s
            match = re.search(r'in (\d+)s', error_msg) or re.search(r'in (\d+) seconds', error_msg)
            sleep_time = int(match.group(1)) if match else 60
            raise QuotaExceededError(sleep_time)

        # If it's a regular error (timeout, broken connection), raise normally
        raise


# =========================================================================
# Specialized Event Router Handlers
# =========================================================================

def handle_motion_detected(image_path: str, metadata: dict) -> Dict[str, Any]:
    return analyze_frame_remotely(image_path=image_path)


def handle_wet_floor_check(image_path: str, metadata: dict) -> Dict[str, Any]:
    time.sleep(1)
    return {"status": "checked", "hazard_detected": False, "type": "wet_floor"}


def handle_zone_compliance(image_path: str, metadata: dict) -> Dict[str, Any]:
    time.sleep(1)
    return {"status": "checked", "unauthorized_person_found": True}


EVENT_ROUTES = {
    "motion_detected": handle_motion_detected,
    "wet_floor_check": handle_wet_floor_check,
    "zone_compliance": handle_zone_compliance
}


# =========================================================================
# Queue Engine & Lifecycle Controllers
# =========================================================================

def process_job(job_id: str):
    """Fetches job payload from BullMQ hash, tracks timestamps, and executes routing."""
    job_key = get_job_key(job_id=job_id)
    job_data_str = redis_client.hget(job_key, "data")
    attempts_made_val = redis_client.hget(job_key, "attemptsMade")
    attempts_made = int(attempts_made_val) if attempts_made_val else "UNKNOWN"

    if not job_data_str:
        logger.warning(f"No data found for job ID: {job_id}")
        return ProcessingResponse(success=False, fatal=True)

    event_id = None
    try:
        job_data = json.loads(job_data_str)
        event_id = job_data.get("eventId")
        event_type = job_data.get("event_type", "motion_detected")
        client_metadata = job_data.get("metadata", {})

        if not event_id:
            logger.error(f"eventId missing in job data for job {job_id}.")
            return ProcessingResponse(success=False, fatal=True)

        start_time = datetime.now(timezone.utc)

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE events 
                    SET status = %s, ai_processing_start_time = %s 
                    WHERE id = %s
                    """,
                    ("PROCESSING", start_time, event_id)
                )
                conn.commit()

                cursor.execute("SELECT image_path FROM events WHERE id = %s", (event_id,))
                row = cursor.fetchone()

                if not row:
                    logger.error(f"Event {event_id} row not found in database.")
                    cursor.execute("UPDATE events SET status = %s WHERE id = %s", ("FAILURE", event_id))
                    conn.commit()
                    return ProcessingResponse(success=False, fatal=True)

                image_path = os.path.join(MEDIA_LOCATION, row[0])

                handler = EVENT_ROUTES.get(event_type)
                if not handler:
                    logger.error(f"No registered handler found for event_type: '{event_type}'")
                    cursor.execute("UPDATE events SET status = %s WHERE id = %s", ("FAILURE", event_id))
                    conn.commit()
                    return ProcessingResponse(success=False, fatal=True)

                # This is where the QuotaExceededError might be thrown
                ai_results = handler(image_path=image_path, metadata=client_metadata)

                end_time = datetime.now(timezone.utc)

                cursor.execute(
                    """
                    UPDATE events 
                    SET status = %s, ai_metadata = %s, ai_processing_end_time = %s 
                    WHERE id = %s
                    """,
                    ("COMPLETED", json.dumps(ai_results), end_time, event_id),
                )
                conn.commit()

                duration = (end_time - start_time).total_seconds()
                logger.info(f"Event {event_id} completed successfully in {duration:.2f}s.")
                return ProcessingResponse(success=True)

    except QuotaExceededError as qe:
        # Mark as failed in Postgres immediately before passing the exception up
        logger.error(f"Quota exceeded while processing job {job_id}. Marking as FAILURE in DB.")
        if event_id:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "UPDATE events SET status = %s, error_message = %s WHERE id = %s",
                            ("FAILURE", str(qe), event_id)
                        )
                        conn.commit()
            except Exception as db_e:
                logger.error(f"Error updating failure status: {db_e}")
        # Bubble up to handle_job so the thread can sleep
        raise qe

    except Exception as e:
        logger.error(f"Error processing job {job_id}: {e}")
        if event_id:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "UPDATE events SET status = %s, error_message = %s WHERE id = %s",
                            ("FAILURE", str(e), event_id)
                        )
                        conn.commit()
            except Exception as db_e:
                logger.error(f"Error updating failure status for event {event_id}: {db_e}")

        return ProcessingResponse(success=False, fatal=False)


def failure_handler(attempts: int, job_id: str, job_key: str, exception: typing.Optional[Exception] = None):
    if attempts <= MAXIMUM_TASK_FAIL_COUNT:
        logger.warning(
            f"Job {job_id} failed. Re-inserting to wait queue (Attempt {attempts}/{MAXIMUM_TASK_FAIL_COUNT})")
        redis_client.lpush(WAIT_LIST_KEY, job_id)
        if exception:
            time.sleep(min(exception.sleep_seconds, 60) if isinstance(exception, QuotaExceededError) else 1)
    else:
        logger.error(f"Job {job_id} permanently failed after {MAXIMUM_TASK_FAIL_COUNT} attempts.")
        timestamp = int(time.time() * 1000)
        redis_client.zadd(f"bull:{QUEUE_NAME}:failed", {job_id: timestamp})
        redis_client.hset(job_key, "failedReason", "Max attempts reached.")


def handle_job(job_id: str):
    job_key = get_job_key(job_id=job_id)
    attempts = redis_client.hincrby(job_key, "attemptsMade", 1)
    success = False
    exception = None

    try:
        success = process_job(job_id=job_id)

    except Exception as e:
        logger.error(f"Error handling job {job_id} inside thread pool: {e}")
        exception = e

    if not success or exception:
        failure_handler(attempts=attempts, job_id=job_id, job_key=job_key, exception=exception)


def main():
    logger.info(f"Started BullMQ Python Worker Engine with {MAX_WORKERS} threads.")
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        while True:
            try:
                result = redis_client.brpop([WAIT_LIST_KEY], timeout=5)
                if result:
                    _, job_id = result
                    executor.submit(handle_job, job_id)
            except Exception as e:
                logger.error(f"Error while polling queue backlog: {e}")
                time.sleep(1)


if __name__ == "__main__":
    main()