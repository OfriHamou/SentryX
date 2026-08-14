import { Router } from "express";
import multer from "multer";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { EventController } from "../controllers/EventController"; 
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";
import { EventReportController } from "../controllers/EventReportController";

const router = Router();

// Setup Redis & BullMQ
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
const redisHost = process.env.REDIS_URL || "localhost";
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const redisConnection = new Redis(redisPort, redisHost, {
    maxRetriesPerRequest: null,
    password: redisPassword,
    retryStrategy(times) {
        if (times > 3) {
            console.error("Redis connection failed after 3 retries. Disabling app features or stopping...");
            process.exit(1);
        }
        return Math.min(times * 50, 2000);
    }
});

redisConnection.on("error", (error) => {
    console.error("Redis background connection error:", error.message);
});

const eventQueue = new Queue("event-processing", { connection: redisConnection as any });

eventQueue.on("error", (error) => {
    console.error("BullMQ Queue background error:", error.message);
});
// Setup Postgres Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD ? encodeURIComponent(process.env.DB_PASSWORD) : ""}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

// Configure Multer Disk Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const baseLocation = process.env.frames_to_process_save_location || "/tmp/sentryx/media/events/";

        // Ensure base directory exists for temporary storage
        if (!fs.existsSync(baseLocation)) {
            fs.mkdirSync(baseLocation, { recursive: true });
        }
        cb(null, baseLocation);
    },
    filename: (req, file, cb) => {
        const fileId = uuidv4();
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `tmp_${fileId}${ext}`);
    }
});
const upload = multer({ storage });

router.post("/report", upload.single("frame"), EventReportController.report(pool, eventQueue));

router.get("/", isLoggedIn, hasAccess("events", "read"), EventController.getEvents);
router.get("/:id/image", EventController.getEventImage);

router.delete("/", isLoggedIn, hasAccess("events", "delete"), EventController.deleteAllEvents);
router.delete("/:id/image", isLoggedIn, hasAccess("events", "delete"), EventController.deleteEventImage);
router.delete("/:id", isLoggedIn, hasAccess("events", "delete"), EventController.deleteEvent);

export default router;
