import { Request, Response } from "express";
import path from "path";
import { AppDataSource } from "../db";
import { Event } from "../models/Event";
import type { AuthIdentityPayload } from "../auth/types";

// DB row -> RobotEvent shape (what the frontend already expects)
function toRobotEvent(event: Event) {
    const meta = event.aiMetadata as { detections?: unknown[]; is_alert?: boolean; source?: string } | null;
    return {
        id: event.id,
        type: event.eventType,
        // a known face is not an alert
        is_alert: typeof meta?.is_alert === "boolean" ? meta.is_alert : event.eventType !== "face_recognized",
        timestamp: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
        image_filename: event.imagePath ? path.basename(event.imagePath) : undefined,
        detections: Array.isArray(meta?.detections) ? meta.detections : undefined,
        source: typeof meta?.source === "string" ? meta.source : "SentryX",
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

    static async getEventImage(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;
            if (!auth?.tenantId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const repo = AppDataSource.getRepository(Event);
            const event = await repo.findOne({
                where: { id: req.params.id, tenant: { id: auth.tenantId } },
            });

            if (!event?.imagePath) {
                res.status(404).json({ ok: false, error: "Event image not found" });
                return;
            }

            return void res.sendFile(event.imagePath, (error) => {
                if (error) {
                    console.error("Error serving event image:", error);
                    if (!res.headersSent) {
                        res.status(404).json({ ok: false, error: "Event image not found" });
                    }
                }
            });
        } catch (error) {
            console.error("Error serving event image:", error);
            res.status(500).json({ ok: false, error: "Failed to serve event image" });
        }
    }
}