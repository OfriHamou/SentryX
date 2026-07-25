import { Request, Response } from "express";
import { SelectQueryBuilder } from "typeorm";
import type { AuthIdentityPayload } from "../auth/types";
import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { User } from "../models/User";
import { logger } from "../utils/logger";

type AlertTab = "all" | "active" | "resolved";

interface AlertFilters {
    from?: Date;
    to?: Date;
    eventType?: string;
    robotId?: string;
    assignedUserId?: string;
}

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

export function alertDisplayTitle(eventType: string | null | undefined): string {
    const knownTitles: Record<string, string> = {
        face_detected_unknown: "Unknown person detected",
        motion_detected: "Motion detected",
        motion: "Motion detected",
        smoke: "Smoke detected",
        fire: "Fire detected",
        wet_floor_check: "Wet floor detected",
        zone_compliance: "Restricted area violation",
    };

    if (!eventType) return "Alert";
    if (knownTitles[eventType]) return knownTitles[eventType];

    const readable = eventType.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return readable.length > 0 ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Alert";
}

export function serializeAlert(alert: Alert) {
    const event = alert.event;
    const robot = event?.robot;
    return {
        id: alert.id,
        status: alert.status,
        displayTitle: alertDisplayTitle(event?.eventType),
        startedAt: alert.startedAt,
        resolvedAt: alert.resolvedAt,
        resolutionNotes: alert.resolutionNotes,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
        assignedUser: alert.assignedUser ? {
            id: alert.assignedUser.id,
            fullName: alert.assignedUser.fullName,
            email: alert.assignedUser.email,
            jobTitle: alert.assignedUser.jobTitle,
        } : null,
        assignedShift: alert.assignedShift ? {
            id: alert.assignedShift.id,
            name: alert.assignedShift.name,
            startAt: alert.assignedShift.startAt,
            endAt: alert.assignedShift.endAt,
            status: alert.assignedShift.status,
        } : null,
        resolvedBy: alert.resolvedBy ? {
            id: alert.resolvedBy.id,
            fullName: alert.resolvedBy.fullName,
            email: alert.resolvedBy.email,
        } : null,
        event: event ? {
            id: event.id,
            eventType: event.eventType,
            imagePath: event.imagePath,
            aiMetadata: event.aiMetadata,
            status: event.status,
            createdAt: event.createdAt,
            robot: robot ? {
                id: robot.id,
                name: robot.name,
                location: robot.location,
                status: robot.status,
            } : null,
        } : null,
    };
}

function addTenantSafeRelations(query: SelectQueryBuilder<Alert>, tenantId: string): SelectQueryBuilder<Alert> {
    return query
        .innerJoinAndSelect("alert.event", "event", "event.tenant_id = :tenantId", { tenantId })
        .innerJoinAndSelect("event.robot", "robot", "robot.tenant_id = :tenantId", { tenantId })
        .leftJoinAndSelect("alert.assignedUser", "assignedUser", "assignedUser.tenant_id = :tenantId", { tenantId })
        .leftJoinAndSelect("alert.assignedShift", "assignedShift", "assignedShift.tenant_id = :tenantId", { tenantId })
        .leftJoinAndSelect("alert.resolvedBy", "resolvedBy", "resolvedBy.tenant_id = :tenantId", { tenantId });
}

function applyFilters(query: SelectQueryBuilder<Alert>, tenantId: string, filters: AlertFilters): SelectQueryBuilder<Alert> {
    query.where("alert.tenant_id = :tenantId", { tenantId });
    if (filters.from) query.andWhere("alert.created_at >= :from", { from: filters.from });
    if (filters.to) query.andWhere("alert.created_at <= :to", { to: filters.to });
    if (filters.eventType) query.andWhere("event.event_type = :eventType", { eventType: filters.eventType });
    if (filters.robotId) query.andWhere("event.robot_id = :robotId", { robotId: filters.robotId });
    if (filters.assignedUserId) query.andWhere("alert.assigned_user_id = :assignedUserId", { assignedUserId: filters.assignedUserId });
    return query;
}

function applyTab(query: SelectQueryBuilder<Alert>, tab: AlertTab): SelectQueryBuilder<Alert> {
    if (tab === "active") {
        query.andWhere("alert.status IN (:...activeStatuses)", {
            activeStatuses: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS],
        });
    } else if (tab === "resolved") {
        query.andWhere("alert.status = :resolvedStatus", { resolvedStatus: AlertStatus.RESOLVED });
    }
    return query;
}

function hydratedAlertQuery(tenantId: string): SelectQueryBuilder<Alert> {
    return addTenantSafeRelations(
        AppDataSource.getRepository(Alert).createQueryBuilder("alert"),
        tenantId,
    );
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

            const listQuery = applyTab(
                applyFilters(hydratedAlertQuery(auth.tenantId), auth.tenantId, filters),
                statusText as AlertTab,
            )
                .orderBy("alert.createdAt", "DESC")
                .take(limit)
                .skip(offset);

            const countQuery = applyFilters(hydratedAlertQuery(auth.tenantId), auth.tenantId, filters)
                .select("COUNT(alert.id)", "all")
                .addSelect("COUNT(alert.id) FILTER (WHERE alert.status IN (:...activeStatuses))", "active")
                .addSelect("COUNT(alert.id) FILTER (WHERE alert.status = :resolvedStatus)", "resolved")
                .setParameters({
                    activeStatuses: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS],
                    resolvedStatus: AlertStatus.RESOLVED,
                });

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
