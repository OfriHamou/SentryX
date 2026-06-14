import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Event } from "../models/Event";
import type { AuthIdentityPayload } from "../auth/types";

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
        const auth = res.locals.auth as AuthIdentityPayload | undefined;
        if (!auth?.tenantId) {
            res.status(401).json({ ok: false, error: "Unauthenticated" });
            return;
        }
        const repo = AppDataSource.getRepository(Event);
        const events = await repo.find({
            where: { tenant: { id: auth.tenantId } },
            order: { createdAt: "DESC" },
            take: 200,
        });
        res.status(200).json({ ok: true, events: events.map(toRobotEvent) });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ ok: false, error: "Failed to fetch events" });
    }
}
}