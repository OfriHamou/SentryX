import { Request, Response } from "express";
import type { AuthIdentityPayload } from "../auth/types";
import { SecurityShiftStatus } from "../models/SecurityShift";
import { OnCallService } from "../services/OnCallService";
import type { AlertTab } from "../services/AlertReadService";
import { logger } from "../utils/logger";

function queryString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseNonNegativeInteger(value: unknown, fallback: number, maximum?: number): number | null {
    if (value === undefined) return fallback;
    const text = queryString(value);
    if (!text || !/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    if (!Number.isSafeInteger(parsed)) return null;
    return maximum === undefined ? parsed : Math.min(parsed, maximum);
}

export class OnCallController {
    static async me(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload;
            const shift = await OnCallService.getCurrentShift(auth.tenantId, auth.userId);
            res.status(200).json({
                ok: true,
                isOnCall: Boolean(shift),
                currentShift: shift ? {
                    id: shift.id,
                    name: shift.name,
                    startAt: shift.startAt,
                    endAt: shift.endAt,
                    status: SecurityShiftStatus.ACTIVE,
                    notes: shift.notes,
                } : null,
            });
        } catch (error) {
            logger.error("Error getting current OnCall duty", error, {
                category: "ON_CALL",
                action: "GET_CURRENT_DUTY_FAILED",
                status: "FAILED",
                context: "OnCallController",
            });
            res.status(500).json({ ok: false, error: "Failed to fetch current duty" });
        }
    }

    static async tasks(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload;
            const status = queryString(req.query.status) ?? "active";
            if (!(["all", "active", "resolved"] as string[]).includes(status)) {
                res.status(400).json({ ok: false, error: "status must be all, active, or resolved" });
                return;
            }

            const limit = parseNonNegativeInteger(req.query.limit, 50, 200);
            const offset = parseNonNegativeInteger(req.query.offset, 0);
            if (limit === null || limit === 0 || offset === null) {
                res.status(400).json({ ok: false, error: "Invalid pagination" });
                return;
            }

            const result = await OnCallService.getTasks(
                auth.tenantId,
                auth.userId,
                status as AlertTab,
                limit,
                offset,
            );
            res.status(200).json({ ok: true, ...result });
        } catch (error) {
            logger.error("Error listing OnCall tasks", error, {
                category: "ON_CALL",
                action: "LIST_ON_CALL_TASKS_FAILED",
                status: "FAILED",
                context: "OnCallController",
            });
            res.status(500).json({ ok: false, error: "Failed to fetch OnCall tasks" });
        }
    }
}
