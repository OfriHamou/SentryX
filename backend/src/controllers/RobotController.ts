import { Request, Response } from "express";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";

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

// Forwards a Jetson JSON response back to the client
// On network/protocol error, returns 502 Bad Gateway
async function forwardJetsonJson(res: Response, url: string, options?: RequestInit) {
    try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(502).json({ 
            ok: false,
            error: "Failed reaching Jetson bridge",
            details: String(error),
        });
    }
}

// Pipes a Jetson binary/stream response back to the client (MJPEG video, JPEG images)
async function pipeJetsonStream(res: Response, url: string, fallbackContentType: string, notFoundMessage: string) {
    try {
        const response = await fetch(url);
        if (!response.ok || !response.body) {
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
        return res.status(502).json({
            ok: false,
            error: notFoundMessage,
            details: String(error),
        });
    }
}

export class RobotController {
    static async getHealth(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_BASE_URL}/health`);
    }

    static async getBattery(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_BASE_URL}/api/battery`);
    }

    static async move(req: Request, res: Response) {
        const { speed, rotation } = req.body;

        if (typeof speed !== "number" || typeof rotation !== "number") {
            return res.status(400).json({
                ok: false,
                error: "speed and rotation must be numbers",
            });
        }

        return forwardJetsonJson(res, `${JETSON_BASE_URL}/api/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ speed, rotation }),
        });
    }

    static async stop(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_BASE_URL}/api/stop`, { method: "POST" });
    }

    static async getVideoStream(req: Request, res: Response) {
        return pipeJetsonStream(
            res,
            `${JETSON_VIDEO_URL}/video_feed`,
            "multipart/x-mixed-replace; boundary=frame",
            "Failed to open robot video stream"
        );
    }

    static async getDetectionHealth(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_DETECTION_URL}/health`);
    }

    static async getDetectionStatus(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_DETECTION_URL}/status`);
    }

    static async getEvents(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_DETECTION_URL}/events`);
    }

    static async getLatestEvent(req: Request, res: Response) {
        return forwardJetsonJson(res, `${JETSON_DETECTION_URL}/latest_event`);
    }

    static async getEventImage(req: Request, res: Response) {
        const { filename } = req.params;
        return pipeJetsonStream(
            res,
            `${JETSON_DETECTION_URL}/images/${encodeURIComponent(filename)}`,
            "image/jpeg",
            "Event image not found"
        );
    }
}