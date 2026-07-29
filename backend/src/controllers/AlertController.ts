import { Request, Response } from "express";
import type { AuthIdentityPayload } from "../auth/types";
import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { User } from "../models/User";
import {
    alertCountsQuery,
    applyAlertFilters,
    applyAlertTab,
    hydratedAlertQuery,
    serializeAlert,
    type AlertFilters,
    type AlertTab,
} from "../services/AlertReadService";
import { logger } from "../utils/logger";

function queryString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseDate(value: unknown): Date | undefined {
    const text = queryString(value);
    if (!text) return undefined;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseNonNegativeInteger(value: unknown, fallback: number, maximum?: number): number | null {
    if (value === undefined) return fallback;
    const text = queryString(value);
    if (!text || !/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    if (!Number.isSafeInteger(parsed)) return null;
    return maximum === undefined ? parsed : Math.min(parsed, maximum);
}

export class AlertController {
    static async list(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload;
            const statusText = queryString(req.query.status) ?? "all";
            if (!(["all", "active", "resolved"] as string[]).includes(statusText)) {
                res.status(400).json({ ok: false, error: "status must be all, active, or resolved" });
                return;
            }

            const limit = parseNonNegativeInteger(req.query.limit, 50, 200);
            const offset = parseNonNegativeInteger(req.query.offset, 0);
            const from = parseDate(req.query.from);
            const to = parseDate(req.query.to);
            if (limit === null || limit === 0 || offset === null) {
                res.status(400).json({ ok: false, error: "Invalid pagination" });
                return;
            }
            if ((req.query.from !== undefined && !from) || (req.query.to !== undefined && !to) || (from && to && from > to)) {
                res.status(400).json({ ok: false, error: "Invalid date range" });
                return;
            }

            const filters: AlertFilters = {
                from,
                to,
                eventType: queryString(req.query.eventType),
                robotId: queryString(req.query.robotId),
                assignedUserId: queryString(req.query.assignedUserId),
            };

            const listQuery = applyAlertTab(
                applyAlertFilters(hydratedAlertQuery(auth.tenantId), auth.tenantId, filters),
                statusText as AlertTab,
            )
                .orderBy("alert.createdAt", "DESC")
                .take(limit)
                .skip(offset);

            const countQuery = alertCountsQuery(auth.tenantId, filters);

            const [[alerts, total], rawCounts] = await Promise.all([
                listQuery.getManyAndCount(),
                countQuery.getRawOne<{ all: string; active: string; resolved: string }>(),
            ]);

            res.status(200).json({
                ok: true,
                alerts: alerts.map(serializeAlert),
                counts: {
                    all: Number(rawCounts?.all ?? 0),
                    active: Number(rawCounts?.active ?? 0),
                    resolved: Number(rawCounts?.resolved ?? 0),
                },
                pagination: { limit, offset, total },
            });
        } catch (error) {
            logger.error("Error listing alerts", error, {
                category: "ALERTS",
                action: "LIST_ALERTS_FAILED",
                status: "FAILED",
                context: "AlertController",
            });
            res.status(500).json({ ok: false, error: "Failed to fetch alerts" });
        }
    }

    static async getOne(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload;
            const alert = await hydratedAlertQuery(auth.tenantId)
                .where("alert.id = :id", { id: req.params.id })
                .andWhere("alert.tenant_id = :tenantId", { tenantId: auth.tenantId })
                .getOne();

            if (!alert) {
                res.status(404).json({ ok: false, error: "Alert not found" });
                return;
            }
            res.status(200).json({ ok: true, alert: serializeAlert(alert) });
        } catch (error) {
            logger.error("Error fetching alert", error, {
                category: "ALERTS",
                action: "GET_ALERT_FAILED",
                status: "FAILED",
                context: "AlertController",
            });
            res.status(500).json({ ok: false, error: "Failed to fetch alert" });
        }
    }

    static async updateStatus(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload;
            const requestedStatus = req.body?.status;
            const notes = req.body?.resolutionNotes;
            if (!Object.values(AlertStatus).includes(requestedStatus)) {
                res.status(400).json({ ok: false, error: "Invalid alert status" });
                return;
            }
            if (notes !== undefined && typeof notes !== "string") {
                res.status(400).json({ ok: false, error: "resolutionNotes must be a string" });
                return;
            }

            const repository = AppDataSource.getRepository(Alert);
            const alert = await repository.findOne({
                where: { id: req.params.id, tenant: { id: auth.tenantId } },
                relations: ["tenant"],
            });
            if (!alert) {
                res.status(404).json({ ok: false, error: "Alert not found" });
                return;
            }

            const allowed =
                (alert.status === AlertStatus.OPEN && (requestedStatus === AlertStatus.IN_PROGRESS || requestedStatus === AlertStatus.RESOLVED)) ||
                (alert.status === AlertStatus.IN_PROGRESS && requestedStatus === AlertStatus.RESOLVED);
            if (!allowed) {
                res.status(409).json({ ok: false, error: `Cannot move alert from ${alert.status} to ${requestedStatus}` });
                return;
            }

            const now = new Date();
            alert.status = requestedStatus;
            if (requestedStatus === AlertStatus.IN_PROGRESS && !alert.startedAt) {
                alert.startedAt = now;
            }
            if (requestedStatus === AlertStatus.RESOLVED) {
                alert.resolvedAt = now;
                alert.resolvedBy = { id: auth.userId } as User;
                if (notes !== undefined) alert.resolutionNotes = notes.trim() || null;
            }

            await repository.save(alert);
            const updated = await hydratedAlertQuery(auth.tenantId)
                .where("alert.id = :id", { id: alert.id })
                .andWhere("alert.tenant_id = :tenantId", { tenantId: auth.tenantId })
                .getOneOrFail();
            res.status(200).json({ ok: true, alert: serializeAlert(updated) });
        } catch (error) {
            logger.error("Error updating alert status", error, {
                category: "ALERTS",
                action: "UPDATE_ALERT_STATUS_FAILED",
                status: "FAILED",
                context: "AlertController",
            });
            res.status(500).json({ ok: false, error: "Failed to update alert status" });
        }
    }
}
