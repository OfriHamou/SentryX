import { Router } from "express";
import multer from "multer";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { EventController } from "../controllers/EventController"; 

const router = Router();

// Setup Redis & BullMQ
const redisPort = parseInt(process.env.redis_port || "6379", 10);
const redisHost = process.env.redis_url || "localhost";
const redisConnection = new Redis(redisPort, redisHost, {
    maxRetriesPerRequest: null,
});
const eventQueue = new Queue("event-processing", { connection: redisConnection });

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

// POST endpoint
router.post("/report", upload.single("frame"), async (req, res) => {
    try {
        const { robot_id, event_type, metadata } = req.body;
        const file = req.file;

        if (!file || !robot_id || !event_type) {
            if (file) fs.unlinkSync(file.path); // Cleanup temp file
            return res.status(400).json({ error: "Missing required fields (frame, robot_id, event_type)" });
        }

        const baseLocation = process.env.frames_to_process_save_location ||  "/tmp/sentryx/media/events/";
        const targetDir = path.join(baseLocation, robot_id);

        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const eventId = uuidv4();
        const ext = path.extname(file.originalname) || '.jpg';
        const finalPath = path.join(targetDir, `${eventId}${ext}`);

        // Move the file to its final destination
        fs.renameSync(file.path, finalPath);

        // Extract relative image path based on the base location
        const imagePath = path.relative(baseLocation, finalPath);

        // Insert into Postgres
        const insertQuery = `
            INSERT INTO events (id, robot_id, event_type, image_path, status) 
            VALUES ($1, $2, $3, $4, 'PENDING')
        `;
        await pool.query(insertQuery, [eventId, robot_id, event_type, imagePath]);

        // Add to BullMQ
            await eventQueue.add("process-frame", {
                eventId,
                imagePath,
                event_type,
                metadata: metadata ? JSON.parse(metadata) : {}
            });

        // Return 201 Created immediately
        return res.status(201).json({
            message: "Event received and queued for processing",
            eventId
        });

    } catch (error) {
        console.error("Error processing event report:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/", EventController.getEvents);   

export default router;

