import { Request, Response } from "express";
import { Queue } from "bullmq";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { AlertService } from "../services/AlertService";
import { logger } from "../utils/logger";

export class EventReportController {
    static report(pool: Pick<Pool, "query">, eventQueue: Pick<Queue, "add">) {
        return async (req: Request, res: Response) => {
            try {
                const { robot_id, event_type, metadata } = req.body;
                const file = req.file;

                if (!file || !robot_id || !event_type) {
                    if (file) fs.unlinkSync(file.path);
                    return res.status(400).json({
                        error: "Missing required fields (frame, robot_id, event_type)",
                    });
                }

                // Parse robot metadata once.
                // This contains face recognition data such as:
                // detections, name, confidence, is_known, etc.
                let parsedMetadata: Record<string, unknown> = {};

                try {
                    if (metadata) {
                        parsedMetadata =
                            typeof metadata === "string"
                                ? JSON.parse(metadata)
                                : metadata;
                    }
                } catch {
                    fs.unlinkSync(file.path);
                    return res.status(400).json({
                        error: "Invalid metadata JSON",
                    });
                }

                // Resolve robot / tenant.
                const robotResult = await pool.query(
                    "SELECT tenant_id, archived_at FROM robots WHERE id = $1",
                    [robot_id]
                );

                const robotRow = robotResult.rows[0];

                if (robotRow?.archived_at) {
                    fs.unlinkSync(file.path);
                    return res.status(409).json({
                        message: "Robot is archived",
                    });
                }

                const tenantId = robotRow?.tenant_id ?? null;

                const baseLocation =
                    process.env.frames_to_process_save_location ||
                    "/tmp/sentryx/media/events/";

                const targetDir = path.join(baseLocation, robot_id);

                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const eventId = uuidv4();
                const ext = path.extname(file.originalname) || ".jpg";
                const finalPath = path.join(targetDir, `${eventId}${ext}`);

                fs.renameSync(file.path, finalPath);

                const imagePath = path.relative(baseLocation, finalPath);

                // Save robot metadata immediately with the event.
                const insertQuery = `
                    INSERT INTO events (
                        id,
                        tenant_id,
                        robot_id,
                        event_type,
                        image_path,
                        ai_metadata,
                        status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'PENDING')
                `;

                await pool.query(insertQuery, [
                    eventId,
                    tenantId,
                    robot_id,
                    event_type,
                    imagePath,
                    JSON.stringify(parsedMetadata),
                ]);

                // Send the same metadata to the AI worker.
                await eventQueue.add("process-frame", {
                    eventId,
                    imagePath,
                    event_type,
                    metadata: parsedMetadata,
                });

                if (AlertService.shouldCreateForEventType(event_type)) {
                    try {
                        if (!tenantId) {
                            throw new Error(
                                `Persisted Event ${eventId} has no tenant and cannot be linked to an Alert`
                            );
                        }

                        await AlertService.createForEvent(eventId, tenantId);
                    } catch (alertError) {
                        console.error(
                            `Failed to create Alert for persisted Event ${eventId}:`,
                            alertError
                        );

                        logger.error(
                            "Failed to create Alert for persisted Event",
                            alertError,
                            {
                                category: "ALERTS",
                                action: "CREATE_ALERT_FOR_EVENT_FAILED",
                                status: "FAILED",
                                context: "eventRoutes.report",
                                metadata: {
                                    eventId,
                                    tenantId,
                                    eventType: event_type,
                                },
                            }
                        );
                    }
                }

                return res.status(201).json({
                    message: "Event received and queued for processing",
                    eventId,
                });
            } catch (error) {
                console.error("Error processing event report:", error);

                return res.status(500).json({
                    error: "Internal server error",
                });
            }
        };
    }
}