import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Event } from "../models/Event";
import type { AuthIdentityPayload } from "../auth/types";
import path from "path";
import fs from "fs";

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
        ai_metadata: event.aiMetadata ?? undefined,
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

    static async getEventImage(req: Request, res: Response): Promise<void> {
        try {
            const event = await AppDataSource.getRepository(Event).findOne({ where: { id: req.params.id } });
            if (!event?.imagePath) {
                res.status(404).json({ ok: false, error: "Not found" });
                return;
            }
            const baseLocation = process.env.frames_to_process_save_location || "/tmp/sentryx/media/events/";
            const filePath = path.resolve(baseLocation, event.imagePath);
            if (!fs.existsSync(filePath)) {
                res.status(404).json({ ok: false, error: "Image not found" });
                return;
            }
            res.sendFile(filePath);
        } catch (error) {
            console.error("Error serving event image:", error);
            res.status(500).json({ ok: false, error: "Failed to serve image" });
        }
    }

    static async deleteEvent(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.tenantId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const repo = AppDataSource.getRepository(Event);

            const event = await repo.findOne({
                where: {
                    id: req.params.id,
                    tenant: { id: auth.tenantId },
                },
            });

            if (!event) {
                res.status(404).json({ ok: false, error: "Event not found" });
                return;
            }

            const imagePath = event.imagePath;

            await repo.remove(event);

            if (imagePath) {
                const baseLocation =
                    process.env.frames_to_process_save_location ||
                    "/tmp/sentryx/media/events/";

                const filePath = path.resolve(baseLocation, imagePath);

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            res.status(200).json({ ok: true });
        } catch (error) {
            console.error("Error deleting event:", error);
            res.status(500).json({
                ok: false,
                error: "Failed to delete event",
            });
        }
    }

    static async deleteEventImage(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.tenantId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const repo = AppDataSource.getRepository(Event);

            const event = await repo.findOne({
                where: {
                    id: req.params.id,
                    tenant: { id: auth.tenantId },
                },
            });

            if (!event) {
                res.status(404).json({ ok: false, error: "Event not found" });
                return;
            }

            const imagePath = event.imagePath;

            // The row stays so the event still counts in history and statistics.
            event.imagePath = null as unknown as string;
            await repo.save(event);

            if (imagePath) {
                const baseLocation = process.env.frames_to_process_save_location || "/tmp/sentryx/media/events/";

                const filePath = path.resolve(baseLocation, imagePath);

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            res.status(200).json({ ok: true });
        } catch (error) {
            console.error("Error deleting event image:", error);
            res.status(500).json({
                ok: false,
                error: "Failed to delete event image",
            });
        }
    }

    static async deleteAllEvents(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.tenantId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const repo = AppDataSource.getRepository(Event);

            const events = await repo.find({
                where: {
                    tenant: { id: auth.tenantId },
                },
            });

            const baseLocation =
                process.env.frames_to_process_save_location ||
                "/tmp/sentryx/media/events/";

            await repo.remove(events);

            for (const event of events) {
                if (!event.imagePath) continue;

                const filePath = path.resolve(baseLocation, event.imagePath);

                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (error) {
                        console.error(
                            `Failed deleting image for event ${event.id}:`,
                            error
                        );
                    }
                }
            }

            res.status(200).json({
                ok: true,
                deleted: events.length,
            });
        } catch (error) {
            console.error("Error deleting events:", error);

            res.status(500).json({
                ok: false,
                error: "Failed to delete events",
            });
        }
    }
}