import { Request, Response } from "express";
import { In, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../db";
import { Event } from "../models/Event";
import { Notification } from "../models/Notification";
import { NotificationRecipient } from "../models/NotificationRecipient";
import { Robot } from "../models/Robot";
import { Tenant } from "../models/Tenant";
import { User } from "../models/User";
import type { AuthIdentityPayload } from "../auth/types";
import { NotificationService } from "../services/NotificationService";
import { alertDisplayTitle } from "../utils/alertDisplayTitle";

const TARGET_APPS = new Set(["CUSTOMER", "ORGANIZATION", "ADMIN"]);
const STATUSES = new Set(["all", "read", "unread"]);

function getAuth(res: Response): AuthIdentityPayload | undefined {
    return res.locals.auth as AuthIdentityPayload | undefined;
}

function getSingleQueryValue(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }

    return undefined;
}

function parseLimit(value: unknown): number {
    const raw = Number(getSingleQueryValue(value));
    if (!Number.isFinite(raw) || raw <= 0) {
        return 50;
    }

    return Math.min(Math.floor(raw), 100);
}

function parseOffset(value: unknown): number {
    const raw = Number(getSingleQueryValue(value));
    if (!Number.isFinite(raw) || raw < 0) {
        return 0;
    }

    return Math.floor(raw);
}

function validateTargetApp(value: unknown): string | undefined | null {
    const targetApp = getSingleQueryValue(value);
    if (!targetApp) {
        return undefined;
    }

    const normalized = targetApp.toUpperCase();
    return TARGET_APPS.has(normalized) ? normalized : null;
}

function validateStatus(value: unknown): string | null {
    const status = getSingleQueryValue(value) || "all";
    return STATUSES.has(status) ? status : null;
}

function validateTargetApps(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }

    const normalized = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.toUpperCase());

    if (normalized.length !== value.length || normalized.some((item) => !TARGET_APPS.has(item))) {
        return null;
    }

    return Array.from(new Set(normalized));
}

function validateStringArray(value: unknown): string[] | null {
    if (value === undefined) {
        return [];
    }

    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
        return null;
    }

    return Array.from(new Set(value.map((item) => item.trim())));
}

function toNotificationResponse(recipient: NotificationRecipient) {
    const notification = recipient.notification;
    const event = notification.event;
    const alert = notification.alert;
    const robot = notification.robot || event?.robot;
    const tenant = notification.tenant;

    return {
        id: notification.id,
        eventId: event?.id ?? null,
        alertId: alert?.id ?? null,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        targetApps: notification.targetApps || [],
        isRead: recipient.readAt !== null,
        readAt: recipient.readAt,
        createdAt: notification.createdAt,
        alert: alert ? {
            id: alert.id,
            status: alert.status,
            displayTitle: alertDisplayTitle(event?.eventType),
            startedAt: alert.startedAt,
            resolvedAt: alert.resolvedAt,
        } : null,
        event: event ? {
            id: event.id,
            eventType: event.eventType,
            imagePath: event.imagePath,
            status: event.status,
            createdAt: event.createdAt,
        } : null,
        robot: robot ? {
            id: robot.id,
            name: robot.name,
            location: robot.location,
            status: robot.status,
        } : null,
        tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
        } : null,
        metadata: notification.metadata,
    };
}

function applyTargetAppFilter(query: SelectQueryBuilder<NotificationRecipient>, targetApp: string) {
    query.andWhere(":targetApp = ANY(notification.target_apps)", { targetApp });
}

export class NotificationController {
    static async createNotification(req: Request, res: Response): Promise<void> {
        try {
            const auth = getAuth(res);
            if (!auth?.userId || !auth.tenantId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const {
                title,
                message,
                severity,
                targetApps: rawTargetApps,
                metadata,
                eventId,
                robotId,
                recipientUserIds: rawRecipientUserIds,
            } = req.body ?? {};

            const targetApps = NotificationService.normalizeTargetApps(rawTargetApps);
            if (!targetApps) {
                res.status(400).json({ ok: false, error: "Invalid targetApps" });
                return;
            }

            const recipientUserIds = NotificationService.normalizeRecipientIds(rawRecipientUserIds);
            if (!recipientUserIds) {
                res.status(400).json({ ok: false, error: "Invalid recipientUserIds" });
                return;
            }

            const finalRecipientUserIds = recipientUserIds.length > 0 ? recipientUserIds : [auth.userId];

            if (metadata !== undefined && (metadata === null || typeof metadata !== "object" || Array.isArray(metadata))) {
                res.status(400).json({ ok: false, error: "metadata must be an object when provided" });
                return;
            }

            const tenant = { id: auth.tenantId } as Tenant;
            const eventRepo = AppDataSource.getRepository(Event);
            const robotRepo = AppDataSource.getRepository(Robot);
            const userRepo = AppDataSource.getRepository(User);

            let event: Event | null = null;
            if (typeof eventId === "string" && eventId.trim().length > 0) {
                event = await eventRepo.findOne({
                    where: { id: eventId, tenant: { id: auth.tenantId } },
                    relations: { robot: true, tenant: true },
                });

                if (!event) {
                    res.status(404).json({ ok: false, error: "Event not found" });
                    return;
                }
            }

            const effectiveRobotId = typeof robotId === "string" && robotId.trim().length > 0
                ? robotId.trim()
                : event?.robot?.id;

            if (event?.robot?.id && typeof robotId === "string" && robotId.trim().length > 0 && robotId.trim() !== event.robot.id) {
                res.status(400).json({ ok: false, error: "robotId must match the event robot" });
                return;
            }

            if (!effectiveRobotId) {
                res.status(400).json({ ok: false, error: "robotId is required when eventId is not provided" });
                return;
            }

            const robot = await robotRepo.findOne({
                where: { id: effectiveRobotId, tenant: { id: auth.tenantId } },
                relations: { tenant: true },
            });

            if (!robot) {
                res.status(404).json({ ok: false, error: "Robot not found" });
                return;
            }

            const users = await userRepo.find({
                where: {
                    id: In(finalRecipientUserIds),
                    tenant: { id: auth.tenantId },
                },
            });

            if (users.length !== finalRecipientUserIds.length) {
                res.status(400).json({ ok: false, error: "One or more recipients were not found in this tenant" });
                return;
            }

            const created = await NotificationService.create({
                tenant,
                robot,
                event,
                title: typeof title === "string" ? title : null,
                message: typeof message === "string" ? message : null,
                severity: typeof severity === "string" ? severity : undefined,
                targetApps,
                metadata: metadata ?? null,
                recipients: users,
            });

            const recipient = await AppDataSource.getRepository(NotificationRecipient)
                .createQueryBuilder("recipient")
                .innerJoinAndSelect("recipient.notification", "notification")
                .leftJoinAndSelect("notification.tenant", "tenant")
                .leftJoinAndSelect("notification.event", "event")
                .leftJoinAndSelect("notification.robot", "robot")
                .leftJoinAndSelect("notification.alert", "alert")
                .leftJoinAndSelect("event.robot", "eventRobot")
                .where("recipient.user_id = :userId", { userId: finalRecipientUserIds[0] })
                .andWhere("notification.id = :notificationId", { notificationId: created.id })
                .getOne();

            res.status(201).json({
                ok: true,
                notification: recipient ? toNotificationResponse(recipient) : { id: created.id },
                recipientCount: finalRecipientUserIds.length,
            });
        } catch (error) {
            console.error("Error creating notification:", error);
            res.status(500).json({ ok: false, error: "Failed to create notification" });
        }
    }

    static async getNotifications(req: Request, res: Response): Promise<void> {
        try {
            const auth = getAuth(res);
            if (!auth?.userId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const targetApp = validateTargetApp(req.query.targetApp);
            if (targetApp === null) {
                res.status(400).json({ ok: false, error: "Invalid targetApp" });
                return;
            }

            const status = validateStatus(req.query.status);
            if (status === null) {
                res.status(400).json({ ok: false, error: "Invalid status" });
                return;
            }

            const limit = parseLimit(req.query.limit);
            const offset = parseOffset(req.query.offset);

            const repo = AppDataSource.getRepository(NotificationRecipient);
            const query = repo.createQueryBuilder("recipient")
                .innerJoinAndSelect("recipient.notification", "notification")
                .leftJoinAndSelect("notification.tenant", "tenant")
                .leftJoinAndSelect("notification.event", "event")
                .leftJoinAndSelect("notification.robot", "robot")
                .leftJoinAndSelect("notification.alert", "alert")
                .leftJoinAndSelect("event.robot", "eventRobot")
                .where("recipient.user_id = :userId", { userId: auth.userId })
                .orderBy("notification.createdAt", "DESC")
                .take(limit)
                .skip(offset);

            if (targetApp) {
                applyTargetAppFilter(query, targetApp);
            }

            if (status === "read") {
                query.andWhere("recipient.read_at IS NOT NULL");
            } else if (status === "unread") {
                query.andWhere("recipient.read_at IS NULL");
            }

            const [recipients, total] = await query.getManyAndCount();
            res.status(200).json({
                ok: true,
                notifications: recipients.map(toNotificationResponse),
                pagination: {
                    limit,
                    offset,
                    total,
                },
            });
        } catch (error) {
            console.error("Error fetching notifications:", error);
            res.status(500).json({ ok: false, error: "Failed to fetch notifications" });
        }
    }

    static async getUnreadCount(req: Request, res: Response): Promise<void> {
        try {
            const auth = getAuth(res);
            if (!auth?.userId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const targetApp = validateTargetApp(req.query.targetApp);
            if (targetApp === null) {
                res.status(400).json({ ok: false, error: "Invalid targetApp" });
                return;
            }

            const repo = AppDataSource.getRepository(NotificationRecipient);
            const query = repo.createQueryBuilder("recipient")
                .innerJoin("recipient.notification", "notification")
                .where("recipient.user_id = :userId", { userId: auth.userId })
                .andWhere("recipient.read_at IS NULL");

            if (targetApp) {
                applyTargetAppFilter(query, targetApp);
            }

            const unreadCount = await query.getCount();
            res.status(200).json({ ok: true, unreadCount });
        } catch (error) {
            console.error("Error fetching unread notification count:", error);
            res.status(500).json({ ok: false, error: "Failed to fetch unread notification count" });
        }
    }

    static async markAllRead(req: Request, res: Response): Promise<void> {
        try {
            const auth = getAuth(res);
            if (!auth?.userId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const targetApp = validateTargetApp(req.query.targetApp);
            if (targetApp === null) {
                res.status(400).json({ ok: false, error: "Invalid targetApp" });
                return;
            }

            const repo = AppDataSource.getRepository(NotificationRecipient);
            const query = repo.createQueryBuilder("recipient")
                .update(NotificationRecipient)
                .set({ readAt: () => "CURRENT_TIMESTAMP" })
                .where("user_id = :userId", { userId: auth.userId })
                .andWhere("read_at IS NULL");

            if (targetApp) {
                query.andWhere(`notification_id IN (
                    SELECT id FROM notifications WHERE :targetApp = ANY(target_apps)
                )`, { targetApp });
            }

            const result = await query.execute();
            res.status(200).json({ ok: true, updatedCount: result.affected || 0 });
        } catch (error) {
            console.error("Error marking all notifications read:", error);
            res.status(500).json({ ok: false, error: "Failed to mark notifications read" });
        }
    }

    static async markRead(req: Request, res: Response): Promise<void> {
        await NotificationController.setReadState(req, res, new Date());
    }

    static async markUnread(req: Request, res: Response): Promise<void> {
        await NotificationController.setReadState(req, res, null);
    }

    private static async setReadState(req: Request, res: Response, readAt: Date | null): Promise<void> {
        try {
            const auth = getAuth(res);
            if (!auth?.userId) {
                res.status(401).json({ ok: false, error: "Unauthenticated" });
                return;
            }

            const notificationId = req.params.id;
            if (!notificationId) {
                res.status(400).json({ ok: false, error: "Missing notification id" });
                return;
            }

            const repo = AppDataSource.getRepository(NotificationRecipient);
            const recipient = await repo.createQueryBuilder("recipient")
                .innerJoinAndSelect("recipient.notification", "notification")
                .leftJoinAndSelect("notification.tenant", "tenant")
                .leftJoinAndSelect("notification.event", "event")
                .leftJoinAndSelect("notification.robot", "robot")
                .leftJoinAndSelect("notification.alert", "alert")
                .leftJoinAndSelect("event.robot", "eventRobot")
                .where("recipient.user_id = :userId", { userId: auth.userId })
                .andWhere("notification.id = :notificationId", { notificationId })
                .getOne();

            if (!recipient) {
                res.status(404).json({ ok: false, error: "Notification not found" });
                return;
            }

            recipient.readAt = readAt;
            const saved = await repo.save(recipient);
            res.status(200).json({ ok: true, notification: toNotificationResponse(saved) });
        } catch (error) {
            console.error("Error updating notification read state:", error);
            res.status(500).json({ ok: false, error: "Failed to update notification read state" });
        }
    }
}
