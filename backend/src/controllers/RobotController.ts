import { Request, Response } from "express";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import type { AuthIdentityPayload } from "../auth/types";
import { logger } from "../utils/logger";

function requireEnvVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const JETSON_BASE_URL = requireEnvVariable("JETSON_BASE_URL");
const JETSON_VIDEO_URL = requireEnvVariable("JETSON_VIDEO_URL");
const JETSON_DETECTION_URL = requireEnvVariable("JETSON_DETECTION_URL");

function getRequestId(req: Request): string | undefined {
    const header = req.headers["x-request-id"];
    if (typeof header === "string" && header.trim().length > 0) {
        return header.trim();
    }

    if (Array.isArray(header) && typeof header[0] === "string" && header[0].trim().length > 0) {
        return header[0].trim();
    }

    return undefined;
}

function buildRobotMeta(
    req: Request,
    res: Response,
    base: Record<string, unknown>
): Record<string, unknown> {
    const auth = res.locals.auth as AuthIdentityPayload | undefined;

    const meta: Record<string, unknown> = {
        ...base,
        context: "RobotController",
        requestId: getRequestId(req)
    };

    if (req.ip) {
        meta.ip = req.ip;
    }

    const userAgent = req.get("user-agent");
    if (userAgent) {
        meta.userAgent = userAgent;
    }

    if (auth?.userId) {
        meta.userId = auth.userId;
    }

    const robotIdParam = req.params.robotId || req.params.id;
    if (robotIdParam) {
        meta.robotId = robotIdParam;
    }

    return meta;
}

// Forwards a Jetson JSON response back to the client
// On network/protocol error, returns 502 Bad Gateway
async function forwardJetsonJson(
    req: Request,
    res: Response,
    url: string,
    options?: RequestInit,
    logContext?: {
        commandName?: string;
        endpointName: string;
    }
) {
    try {
        const response = await fetch(url, options);
        if (!response.ok && logContext?.commandName) {
            logger.warn("Robot command failed", buildRobotMeta(req, res, {
                category: "ROBOT",
                action: "COMMAND_FAILED",
                status: "FAILED",
                metadata: {
                    commandName: logContext.commandName,
                    endpointName: logContext.endpointName,
                    upstreamStatusCode: response.status
                }
            }));
        }

        const data = await response.json().catch(() => ({}));
        return res.status(response.status).json(data);
    } catch (error) {
        logger.error("Robot communication error", error, buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMUNICATION_ERROR",
            status: "FAILED",
            metadata: {
                endpointName: logContext?.endpointName
            }
        }));

        if (logContext?.commandName) {
            logger.error("Robot command failed", error, buildRobotMeta(req, res, {
                category: "ROBOT",
                action: "COMMAND_FAILED",
                status: "FAILED",
                metadata: {
                    commandName: logContext.commandName,
                    endpointName: logContext.endpointName
                }
            }));
        }

        return res.status(502).json({ 
            ok: false,
            error: "Failed reaching Jetson bridge",
            details: String(error),
        });
    }
}

// Pipes a Jetson binary/stream response back to the client (MJPEG video, JPEG images)
async function pipeJetsonStream(
    req: Request,
    res: Response,
    url: string,
    fallbackContentType: string,
    notFoundMessage: string,
    endpointName: string
) {
    try {
        const response = await fetch(url);
        if (!response.ok || !response.body) {
            logger.error("Robot communication error", undefined, buildRobotMeta(req, res, {
                category: "ROBOT",
                action: "COMMUNICATION_ERROR",
                status: "FAILED",
                metadata: {
                    endpointName,
                    upstreamStatusCode: response.status
                }
            }));

            return res.status(502).json({
                ok: false,
                error: notFoundMessage,
            });
        }

        res.setHeader(
            "Content-Type",
            response.headers.get("Content-Type") || fallbackContentType
        );
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        Readable.fromWeb(response.body as unknown as NodeReadableStream).pipe(res);
    } catch (error) {
        logger.error("Robot communication error", error, buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMUNICATION_ERROR",
            status: "FAILED",
            metadata: {
                endpointName
            }
        }));

        return res.status(502).json({
            ok: false,
            error: notFoundMessage,
            details: String(error),
        });
    }
}

export class RobotController {
    static async getHealth(req: Request, res: Response) {
        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/health`, undefined, {
            endpointName: "health"
        });
    }

    static async getBattery(req: Request, res: Response) {
        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/api/battery`, undefined, {
            endpointName: "battery"
        });
    }

    static async move(req: Request, res: Response) {
        const { speed, rotation } = req.body;

        if (typeof speed !== "number" || typeof rotation !== "number") {
            return res.status(400).json({
                ok: false,
                error: "speed and rotation must be numbers",
            });
        }

        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: {
                commandName: "move",
                speed,
                rotation
            }
        }));

        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/api/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ speed, rotation }),
        }, {
            commandName: "move",
            endpointName: "api/move"
        });
    }

    static async stop(req: Request, res: Response) {
        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: {
                commandName: "stop"
            }
        }));

        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/api/stop`, { method: "POST" }, {
            commandName: "stop",
            endpointName: "api/stop"
        });
    }

    static async getVideoStream(req: Request, res: Response) {
        return pipeJetsonStream(
            req,
            res,
            `${JETSON_VIDEO_URL}/video_feed`,
            "multipart/x-mixed-replace; boundary=frame",
            "Failed to open robot video stream",
            "video_feed"
        );
    }

    static async getDetectionHealth(req: Request, res: Response) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/health`, undefined, {
            endpointName: "detection/health"
        });
    }

    static async getDetectionStatus(req: Request, res: Response) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/status`, undefined, {
            endpointName: "detection/status"
        });
    }

    static async getEvents(req: Request, res: Response) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/events`, undefined, {
            endpointName: "events"
        });
    }

    static async getLatestEvent(req: Request, res: Response) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/latest_event`, undefined, {
            endpointName: "events/latest"
        });
    }

    static async getEventImage(req: Request, res: Response) {
        const { filename } = req.params;
        return pipeJetsonStream(
            req,
            res,
            `${JETSON_DETECTION_URL}/images/${encodeURIComponent(filename)}`,
            "image/jpeg",
            "Event image not found",
            "events/image"
        );
    }
}