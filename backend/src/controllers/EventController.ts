import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Event } from "../models/Event";

// DB row -> RobotEvent shape (what the frontend already expects)
function toRobotEvent(event: Event) {
    const meta = event.aiMetadata as { detections?: unknown[] } | null;
    return {
        id: event.id,
        type: event.eventType,
        // a known face is not an alert
        is_alert: event.eventType !== "face_recognized",
        timestamp: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
        image_filename: event.imagePath ? event.imagePath.split("/").pop() : undefined,
        detections: Array.isArray(meta?.detections) ? meta.detections : undefined,
        source: "SentryX",
        status: event.status,
    };
}

export class EventController {
    static async getEvents(req: Request, res: Response): Promise<void> {
        try {
            const repo = AppDataSource.getRepository(Event); 
            const events = await repo.find({ order: { createdAt: "DESC" }, take: 200 });
            res.status(200).json({ ok: true, events: events.map(toRobotEvent) });
        } catch (error) {
            console.error("Error fetching events:", error);
            res.status(500).json({ ok: false, error: "Failed to fetch events" });
        }
    }
}