import { Request, Response as ExpressResponse } from "express";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import type { AuthIdentityPayload } from "../auth/types";
import { logger } from "../utils/logger";
import { AppDataSource } from "../db";
import { Robot } from "../models/Robot";

type RobotControlMode = "manual" | "auto";

interface JetsonRequestContext {
    endpointName: string;
    commandName?: string;
}

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
const JETSON_AVOIDANCE_URL = requireEnvVariable("JETSON_AVOIDANCE_URL");
const JETSON_REQUEST_TIMEOUT_MS = Number(process.env.JETSON_REQUEST_TIMEOUT_MS || 5000);

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
    res: ExpressResponse,
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

function normalizeControlMode(mode: unknown): RobotControlMode | null {
    return mode === "manual" || mode === "auto" ? mode : null;
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<globalThis.Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JETSON_REQUEST_TIMEOUT_MS);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function requestJetsonJson(
    req: Request,
    res: ExpressResponse,
    url: string,
    options?: RequestInit,
    logContext?: JetsonRequestContext
) {
    try {
        const response = await fetchWithTimeout(url, options);
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
        return { response, data };
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

        throw error;
    }
}

async function forwardJetsonJson(
    req: Request,
    res: ExpressResponse,
    url: string,
    options?: RequestInit,
    logContext?: JetsonRequestContext
) {
    try {
        const { response, data } = await requestJetsonJson(req, res, url, options, logContext);
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(502).json({
            ok: false,
            error: "Failed reaching Jetson bridge",
            details: String(error),
        });
    }
}

async function pipeJetsonStream(
    req: Request,
    res: ExpressResponse,
    url: string,
    fallbackContentType: string,
    notFoundMessage: string,
    endpointName: string
) {
    try {
        const response = await fetchWithTimeout(url);
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

async function commandJetson(
    req: Request,
    res: ExpressResponse,
    url: string,
    method: string,
    commandName: string,
    endpointName: string,
    body?: unknown
) {
    return requestJetsonJson(
        req,
        res,
        url,
        {
            method,
            headers: body === undefined ? undefined : { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        },
        {
            commandName,
            endpointName,
        }
    );
}

async function setRobotStopped(req: Request, res: ExpressResponse) {
    return commandJetson(req, res, `${JETSON_BASE_URL}/api/stop`, "POST", "stop", "api/stop");
}

async function pauseAvoidance(req: Request, res: ExpressResponse) {
    return commandJetson(req, res, `${JETSON_AVOIDANCE_URL}/pause`, "POST", "pause_auto", "avoidance/pause");
}

async function stopAvoidance(req: Request, res: ExpressResponse) {
    return commandJetson(req, res, `${JETSON_AVOIDANCE_URL}/stop`, "POST", "stop_auto", "avoidance/stop");
}

async function setJetsonControlMode(req: Request, res: ExpressResponse, mode: RobotControlMode) {
    return commandJetson(
        req,
        res,
        `${JETSON_BASE_URL}/api/control-mode`,
        "POST",
        "set_control_mode",
        "api/control-mode",
        { mode }
    );
}

async function getJetsonControlMode(req: Request, res: ExpressResponse) {
    const { data } = await requestJetsonJson(
        req,
        res,
        `${JETSON_BASE_URL}/api/control-mode`,
        undefined,
        { endpointName: "api/control-mode" }
    );
    const mode = normalizeControlMode(data.mode);
    if (!mode) {
        throw new Error(`Unexpected control mode response: ${JSON.stringify(data)}`);
    }
    return mode;
}

export class RobotController {
    static async getHealth(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/health`, undefined, {
            endpointName: "health"
        });
    }

    static async getBattery(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/api/battery`, undefined, {
            endpointName: "battery"
        });
    }

    static async move(req: Request, res: ExpressResponse) {
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

    static async stop(req: Request, res: ExpressResponse) {
        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: {
                commandName: "stop"
            }
        }));

        try {
            const stopResult = await setRobotStopped(req, res);
            const pauseResult = await pauseAvoidance(req, res);

            if (!stopResult.response.ok || !pauseResult.response.ok) {
                return res.status(502).json({
                    ok: false,
                    error: "Emergency stop did not complete successfully",
                    motorStop: stopResult.data,
                    avoidance: pauseResult.data,
                });
            }

            return res.status(200).json({
                ok: true,
                motorStop: stopResult.data,
                avoidance: pauseResult.data,
            });
        } catch (error) {
            return res.status(502).json({
                ok: false,
                error: "Failed reaching Jetson bridge",
                details: String(error),
            });
        }
    }

    static async getVideoStream(req: Request, res: ExpressResponse) {
        return pipeJetsonStream(
            req,
            res,
            `${JETSON_VIDEO_URL}/video_feed`,
            "multipart/x-mixed-replace; boundary=frame",
            "Failed to open robot video stream",
            "video_feed"
        );
    }

    static async getDetectionHealth(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/health`, undefined, {
            endpointName: "detection/health"
        });
    }

    static async getDetectionStatus(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/status`, undefined, {
            endpointName: "detection/status"
        });
    }

    static async getAvoidanceHealth(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_AVOIDANCE_URL}/health`, undefined, {
            endpointName: "avoidance/health"
        });
    }

    static async getAvoidanceStatus(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_AVOIDANCE_URL}/status`, undefined, {
            endpointName: "avoidance/status"
        });
    }

    static async startAvoidance(req: Request, res: ExpressResponse) {
        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: { commandName: "start_auto" }
        }));
        return forwardJetsonJson(req, res, `${JETSON_AVOIDANCE_URL}/start`, { method: "POST" }, {
            commandName: "start_auto",
            endpointName: "avoidance/start"
        });
    }

    static async stopAvoidance(req: Request, res: ExpressResponse) {
        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: { commandName: "stop_auto" }
        }));
        return forwardJetsonJson(req, res, `${JETSON_AVOIDANCE_URL}/stop`, { method: "POST" }, {
            commandName: "stop_auto",
            endpointName: "avoidance/stop"
        });
    }

    static async pauseAvoidance(req: Request, res: ExpressResponse) {
        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: { commandName: "pause_auto" }
        }));
        return forwardJetsonJson(req, res, `${JETSON_AVOIDANCE_URL}/pause`, { method: "POST" }, {
            commandName: "pause_auto",
            endpointName: "avoidance/pause"
        });
    }

    static async resumeAvoidance(req: Request, res: ExpressResponse) {
        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: { commandName: "resume_auto" }
        }));
        return forwardJetsonJson(req, res, `${JETSON_AVOIDANCE_URL}/resume`, { method: "POST" }, {
            commandName: "resume_auto",
            endpointName: "avoidance/resume"
        });
    }

    static async getControlMode(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_BASE_URL}/api/control-mode`, undefined, {
            endpointName: "api/control-mode"
        });
    }

    static async setControlMode(req: Request, res: ExpressResponse) {
        const mode = normalizeControlMode(req.body?.mode);
        if (!mode) {
            return res.status(400).json({
                ok: false,
                error: "mode must be 'manual' or 'auto'",
            });
        }

        logger.info("Robot command sent", buildRobotMeta(req, res, {
            category: "ROBOT",
            action: "COMMAND_SENT",
            status: "SUCCESS",
            metadata: { commandName: "set_control_mode", mode }
        }));

        try {
            if (mode === "auto") {
                await setRobotStopped(req, res);
                const modeResult = await setJetsonControlMode(req, res, "auto");
                if (!modeResult.response.ok) {
                    await setRobotStopped(req, res).catch(() => undefined);
                    return res.status(modeResult.response.status).json(modeResult.data);
                }

                const startResult = await commandJetson(
                    req,
                    res,
                    `${JETSON_AVOIDANCE_URL}/start`,
                    "POST",
                    "start_auto",
                    "avoidance/start"
                );

                if (!startResult.response.ok) {
                    await setRobotStopped(req, res).catch(() => undefined);
                    await stopAvoidance(req, res).catch(() => undefined);
                    await setJetsonControlMode(req, res, "manual").catch(() => undefined);
                    return res.status(startResult.response.status).json({
                        ok: false,
                        error: "Failed to start autonomous mode",
                        mode: "manual",
                        details: startResult.data,
                    });
                }

                return res.status(200).json({
                    ok: true,
                    mode: "auto",
                    avoidance: startResult.data,
                });
            }

            const stopResult = await stopAvoidance(req, res);
            await setRobotStopped(req, res);

            if (!stopResult.response.ok) {
                await setRobotStopped(req, res).catch(() => undefined);
                return res.status(stopResult.response.status).json({
                    ok: false,
                    error: "Failed to stop autonomous mode",
                    details: stopResult.data,
                });
            }

            const modeResult = await setJetsonControlMode(req, res, "manual");
            if (!modeResult.response.ok) {
                await setRobotStopped(req, res).catch(() => undefined);
                return res.status(modeResult.response.status).json(modeResult.data);
            }

            return res.status(200).json({
                ok: true,
                mode: "manual",
                avoidance: stopResult.data,
            });
        } catch (error) {
            await setRobotStopped(req, res).catch(() => undefined);
            await pauseAvoidance(req, res).catch(() => undefined);
            return res.status(502).json({
                ok: false,
                error: "Failed to transition robot control mode",
                details: String(error),
            });
        }
    }

    static async getEvents(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/events`, undefined, {
            endpointName: "events"
        });
    }

    static async getLatestEvent(req: Request, res: ExpressResponse) {
        return forwardJetsonJson(req, res, `${JETSON_DETECTION_URL}/latest_event`, undefined, {
            endpointName: "events/latest"
        });
    }

    static async getEventImage(req: Request, res: ExpressResponse) {
        const { filename } = req.params;
        return pipeJetsonStream(
            req,
            res,
            `${JETSON_DETECTION_URL}/image/${encodeURIComponent(filename)}`,
            "image/jpeg",
            "Event image not found",
            "events/image"
        );
    }

    static async getMyRobot(req: Request, res: ExpressResponse) {
        const auth = res.locals.auth as AuthIdentityPayload | undefined;
        if (!auth?.tenantId) {
            return res.status(401).json({ ok: false, error: "Unauthenticated" });
        }
        try {
            const robot = await AppDataSource.getRepository(Robot).findOne({
                where: { tenant: { id: auth.tenantId } },
                order: { updatedAt: "DESC" },
            });
            if (!robot) return res.status(404).json({ ok: false, error: "No robot for tenant" });

            let controlMode: RobotControlMode = "manual";
            try {
                controlMode = await getJetsonControlMode(req, res);
            } catch (error) {
                logger.warn("Failed to fetch robot control mode", buildRobotMeta(req, res, {
                    category: "ROBOT",
                    action: "CONTROL_MODE_FETCH_FAILED",
                    status: "FAILED",
                    metadata: { details: String(error) }
                }));
            }

            return res.status(200).json({
                ok: true,
                robot: {
                    id: robot.id,
                    name: robot.name,
                    location: robot.location ?? null,
                    status: robot.status,
                    controlMode,
                },
            });
        } catch (error) {
            console.error("Error fetching current robot:", error);
            return res.status(500).json({ ok: false, error: "Failed to fetch robot" });
        }
    }

    static async updateMyRobot(req: Request, res: ExpressResponse) {
        const auth = res.locals.auth as AuthIdentityPayload | undefined;
        if (!auth?.tenantId) {
            return res.status(401).json({ ok: false, error: "Unauthenticated" });
        }
        try {
            const repo = AppDataSource.getRepository(Robot);
            const robot = await repo.findOne({
                where: { tenant: { id: auth.tenantId } },
                order: { updatedAt: "DESC" },
            });
            if (!robot) return res.status(404).json({ ok: false, error: "No robot for tenant" });

            const { name, location } = req.body ?? {};
            if (typeof name === "string" && name.trim()) robot.name = name.trim();
            if (typeof location === "string") robot.location = location.trim();
            await repo.save(robot);

            return res.status(200).json({
                ok: true,
                robot: { id: robot.id, name: robot.name, location: robot.location ?? null, status: robot.status },
            });
        } catch (error) {
            console.error("Error updating robot:", error);
            return res.status(500).json({ ok: false, error: "Failed to update robot" });
        }
    }
}