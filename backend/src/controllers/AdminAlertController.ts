import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import type { AuthIdentityPayload } from "../auth/types";
import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { User } from "../models/User";
import {
    adminAlertCountsQuery,
    applyAdminAlertFilters,
    applyAdminAlertStatus,
    hydratedAdminAlertQuery,
    serializeAdminAlert,
    type AdminAlertFilters,
    type AdminAlertStatusFilter,
} from "../services/AdminAlertReadService";
import { logger } from "../utils/logger";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const STATUSES: AdminAlertStatusFilter[] = ["all", "active", "open", "in_progress", "resolved"];

function queryText(value: unknown): string | undefined {
    return typeof value === "string" ? value.trim() : undefined;
}

function parseDate(value: unknown): Date | undefined {
    const text = queryText(value);
    if (!text || !ISO_DATE_PATTERN.test(text)) return undefined;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseInteger(value: unknown, fallback: number): number | null {
    if (value === undefined) return fallback;
    const text = queryText(value);
    if (!text || !/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function validId(id: string): boolean {
    return UUID_PATTERN.test(id);
}

function logFailure(action: string, context: string, error: unknown): void {
    logger.error(`Admin Alert operation failed: ${action}`, error, {
        category: "ADMIN_ALERTS",
        action,
        status: "FAILED",
        context,
    });
}

export class AdminAlertController {
    static async list(req: Request, res: Response): Promise<void> {
        try {
            const scalarFilters = ["status", "tenantId", "from", "to", "search", "limit", "offset"] as const;
            if (scalarFilters.some((name) => req.query[name] !== undefined && typeof req.query[name] !== "string")) {
                res.status(400).json({ ok: false, error: "Query filters must be supplied once" });
                return;
            }
            const status = req.query.status === undefined
                ? "all"
                : (queryText(req.query.status) || "").toLowerCase();
            const tenantId = queryText(req.query.tenantId);
            const search = queryText(req.query.search);
            const from = parseDate(req.query.from);
            const to = parseDate(req.query.to);
            const limit = parseInteger(req.query.limit, 50);
            const offset = parseInteger(req.query.offset, 0);

            if (!STATUSES.includes(status as AdminAlertStatusFilter)) {
                res.status(400).json({ ok: false, error: "Unsupported status filter" });
                return;
            }
            if (req.query.tenantId !== undefined && (!tenantId || !validId(tenantId))) {
                res.status(400).json({ ok: false, error: "Invalid tenantId" });
                return;
            }
            if ((req.query.from !== undefined && !from) || (req.query.to !== undefined && !to)) {
                res.status(400).json({ ok: false, error: "Invalid date" });
                return;
            }
            if (from && to && from > to) {
                res.status(400).json({ ok: false, error: "from must not be later than to" });
                return;
            }
            if (limit === null || limit < 1 || limit > 200) {
                res.status(400).json({ ok: false, error: "limit must be between 1 and 200" });
                return;
            }
            if (offset === null || offset < 0) {
                res.status(400).json({ ok: false, error: "offset must be a non-negative integer" });
                return;
            }
            if (search !== undefined && search.length > 100) {
                res.status(400).json({ ok: false, error: "search must be at most 100 characters" });
                return;
            }

            const filters: AdminAlertFilters = { tenantId, from, to, search: search || undefined };
            const listQuery = applyAdminAlertStatus(
                applyAdminAlertFilters(hydratedAdminAlertQuery(), filters),
                status as AdminAlertStatusFilter,
            )
                .orderBy("alert.createdAt", "DESC")
                .addOrderBy("alert.id", "DESC")
                .take(limit)
                .skip(offset);

            const [[alerts, total], rawCounts] = await Promise.all([
                listQuery.getManyAndCount(),
                adminAlertCountsQuery(filters).getRawOne<{
                    all: string;
                    open: string;
                    inProgress: string;
                    active: string;
                    resolved: string;
                    tenantsWithActive: string;
                }>(),
            ]);

            res.status(200).json({
                ok: true,
                alerts: alerts.map(serializeAdminAlert),
                counts: {
                    all: Number(rawCounts?.all ?? 0),
                    open: Number(rawCounts?.open ?? 0),
                    inProgress: Number(rawCounts?.inProgress ?? 0),
                    active: Number(rawCounts?.active ?? 0),
                    resolved: Number(rawCounts?.resolved ?? 0),
                    tenantsWithActive: Number(rawCounts?.tenantsWithActive ?? 0),
                },
                pagination: { limit, offset, total },
            });
        } catch (error) {
            logFailure("LIST_ADMIN_ALERTS_FAILED", "AdminAlertController.list", error);
            res.status(500).json({ ok: false, error: "Failed to fetch Admin Alerts" });
        }
    }

    static async getOne(req: Request, res: Response): Promise<void> {
        if (!validId(req.params.id)) {
            res.status(400).json({ ok: false, error: "Invalid Alert ID" });
            return;
        }
        try {
            const alert = await hydratedAdminAlertQuery()
                .where("alert.id = :id", { id: req.params.id })
                .getOne();
            if (!alert) {
                res.status(404).json({ ok: false, error: "Alert not found" });
                return;
            }
            res.status(200).json({ ok: true, alert: serializeAdminAlert(alert) });
        } catch (error) {
            logFailure("GET_ADMIN_ALERT_FAILED", "AdminAlertController.getOne", error);
            res.status(500).json({ ok: false, error: "Failed to fetch Admin Alert" });
        }
    }

    static async updateStatus(req: Request, res: Response): Promise<void> {
        if (!validId(req.params.id)) {
            res.status(400).json({ ok: false, error: "Invalid Alert ID" });
            return;
        }
        const requestedStatus = req.body?.status;
        const notes = req.body?.resolutionNotes;
        if (!Object.values(AlertStatus).includes(requestedStatus)) {
            res.status(400).json({ ok: false, error: "Invalid Alert status" });
            return;
        }
        if (notes !== undefined && typeof notes !== "string") {
            res.status(400).json({ ok: false, error: "resolutionNotes must be a string" });
            return;
        }
        if (typeof notes === "string" && notes.length > 1000) {
            res.status(400).json({ ok: false, error: "resolutionNotes must be at most 1,000 characters" });
            return;
        }

        try {
            const auth = res.locals.auth as AuthIdentityPayload;
            const repository = AppDataSource.getRepository(Alert);
            const alert = await repository.findOne({ where: { id: req.params.id } });
            if (!alert) {
                res.status(404).json({ ok: false, error: "Alert not found" });
                return;
            }

            const allowed =
                (alert.status === AlertStatus.OPEN
                    && (requestedStatus === AlertStatus.IN_PROGRESS || requestedStatus === AlertStatus.RESOLVED))
                || (alert.status === AlertStatus.IN_PROGRESS && requestedStatus === AlertStatus.RESOLVED);
            if (!allowed) {
                res.status(409).json({
                    ok: false,
                    error: `Cannot move Alert from ${alert.status} to ${requestedStatus}`,
                });
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
                alert.resolutionNotes = typeof notes === "string" ? notes.trim() || null : null;
            }
            await repository.save(alert);

            const updated = await hydratedAdminAlertQuery()
                .where("alert.id = :id", { id: alert.id })
                .getOneOrFail();
            res.status(200).json({ ok: true, alert: serializeAdminAlert(updated) });
        } catch (error) {
            logFailure("UPDATE_ADMIN_ALERT_STATUS_FAILED", "AdminAlertController.updateStatus", error);
            res.status(500).json({ ok: false, error: "Failed to update Admin Alert status" });
        }
    }

    static async getImage(req: Request, res: Response): Promise<void> {
        if (!validId(req.params.id)) {
            res.status(400).json({ ok: false, error: "Invalid Alert ID" });
            return;
        }
        try {
            const alert = await AppDataSource.getRepository(Alert).findOne({
                where: { id: req.params.id },
                relations: ["event"],
            });
            if (!alert?.event?.imagePath) {
                res.status(404).json({ ok: false, error: "Alert image not found" });
                return;
            }

            const mediaDirectory = path.resolve(
                process.env.frames_to_process_save_location || "/tmp/sentryx/media/events/",
            );
            const imagePath = alert.event.imagePath;
            if (path.isAbsolute(imagePath)) {
                res.status(404).json({ ok: false, error: "Alert image not found" });
                return;
            }
            const resolvedPath = path.resolve(mediaDirectory, imagePath);
            if (!resolvedPath.startsWith(`${mediaDirectory}${path.sep}`)) {
                res.status(404).json({ ok: false, error: "Alert image not found" });
                return;
            }
            const [realMediaDirectory, realImagePath] = await Promise.all([
                fs.promises.realpath(mediaDirectory).catch(() => null),
                fs.promises.realpath(resolvedPath).catch(() => null),
            ]);
            if (
                !realMediaDirectory
                || !realImagePath
                || !realImagePath.startsWith(`${realMediaDirectory}${path.sep}`)
            ) {
                res.status(404).json({ ok: false, error: "Alert image not found" });
                return;
            }
            const stat = await fs.promises.stat(realImagePath).catch(() => null);
            if (!stat?.isFile()) {
                res.status(404).json({ ok: false, error: "Alert image not found" });
                return;
            }
            res.sendFile(realImagePath);
        } catch (error) {
            logFailure("GET_ADMIN_ALERT_IMAGE_FAILED", "AdminAlertController.getImage", error);
            res.status(500).json({ ok: false, error: "Failed to serve Admin Alert image" });
        }
    }
}
