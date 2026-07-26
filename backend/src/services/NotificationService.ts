import { EntityManager } from "typeorm";
import { AppDataSource } from "../db";
import { Alert } from "../models/Alert";
import { Event } from "../models/Event";
import { Notification } from "../models/Notification";
import { NotificationRecipient } from "../models/NotificationRecipient";
import { Robot } from "../models/Robot";
import { Tenant } from "../models/Tenant";
import { User, UserStatus } from "../models/User";
import { logger } from "../utils/logger";
import { alertDisplayTitle } from "../utils/alertDisplayTitle";

export const NOTIFICATION_TARGET_APPS = ["CUSTOMER", "ORGANIZATION", "ADMIN"] as const;
export type NotificationTargetApp = typeof NOTIFICATION_TARGET_APPS[number];

export interface CreateNotificationInput {
    tenant: Tenant;
    robot: Robot;
    event?: Event | null;
    alert?: Alert | null;
    title?: string | null;
    message?: string | null;
    severity?: string;
    targetApps: NotificationTargetApp[];
    metadata?: Record<string, unknown> | null;
    recipients: User[];
}

export class NotificationService {
    static normalizeTargetApps(value: unknown): NotificationTargetApp[] | null {
        if (!Array.isArray(value) || value.length === 0) return null;

        const normalized = value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.toUpperCase());
        const validApps = new Set<string>(NOTIFICATION_TARGET_APPS);
        if (normalized.length !== value.length || normalized.some((item) => !validApps.has(item))) {
            return null;
        }

        return Array.from(new Set(normalized)) as NotificationTargetApp[];
    }

    static normalizeRecipientIds(value: unknown): string[] | null {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
            return null;
        }
        return Array.from(new Set(value.map((item) => item.trim())));
    }

    static async create(input: CreateNotificationInput): Promise<Notification> {
        const recipients = Array.from(new Map(input.recipients.map((user) => [user.id, user])).values());

        return AppDataSource.transaction(async (manager) => {
            const notification = manager.create(Notification, {
                tenant: input.tenant,
                robot: input.robot,
                event: input.event ?? null,
                alert: input.alert ?? null,
                title: input.title ?? null,
                message: input.message ?? null,
                severity: input.severity?.trim() || "info",
                targetApps: input.targetApps,
                metadata: input.metadata ?? null,
            });
            const savedNotification = await manager.save(Notification, notification);
            await NotificationService.addRecipients(manager, savedNotification, recipients);
            return savedNotification;
        });
    }

    static async ensureForAlert(alertId: string, tenantId: string): Promise<Notification> {
        const alert = await AppDataSource.getRepository(Alert)
            .createQueryBuilder("alert")
            .innerJoinAndSelect("alert.tenant", "tenant")
            .innerJoinAndSelect("alert.event", "event", "event.tenant_id = :tenantId", { tenantId })
            .innerJoinAndSelect("event.robot", "robot", "robot.tenant_id = :tenantId", { tenantId })
            .leftJoinAndSelect("alert.assignedUser", "assignedUser", "assignedUser.tenant_id = :tenantId", { tenantId })
            .where("alert.id = :alertId", { alertId })
            .andWhere("alert.tenant_id = :tenantId", { tenantId })
            .getOne();

        if (!alert) {
            throw new Error(`Tenant-scoped Alert ${alertId} could not be loaded for Notification creation`);
        }

        const recipients = await NotificationService.findAlertRecipients(alert, tenantId);
        if (recipients.length === 0) {
            logger.warn("No eligible Notification recipients were available for Alert", {
                category: "NOTIFICATIONS",
                action: "ALERT_NOTIFICATION_NO_RECIPIENTS",
                status: "SKIPPED",
                context: "NotificationService.ensureForAlert",
                metadata: { alertId, tenantId },
            });
        }

        return AppDataSource.transaction(async (manager) => {
            await manager.createQueryBuilder()
                .insert()
                .into(Notification)
                .values({
                    tenant: { id: tenantId } as Tenant,
                    robot: { id: alert.event.robot.id } as Robot,
                    event: { id: alert.event.id } as Event,
                    alert: { id: alert.id } as Alert,
                    title: alertDisplayTitle(alert.event.eventType),
                    message: `Operational alert reported by ${alert.event.robot.name}`,
                    severity: "warning",
                    targetApps: ["CUSTOMER", "ORGANIZATION"],
                    metadata: null,
                } as any)
                .orIgnore()
                .execute();

            const notification = await manager.getRepository(Notification).findOne({
                where: { alert: { id: alert.id }, tenant: { id: tenantId } },
                relations: { alert: true, event: true, robot: true, tenant: true },
            });
            if (!notification) {
                throw new Error(`Alert Notification could not be created or found for Alert ${alert.id}`);
            }

            await NotificationService.addRecipients(manager, notification, recipients);
            return notification;
        });
    }

    private static async findAlertRecipients(alert: Alert, tenantId: string): Promise<User[]> {
        const repository = AppDataSource.getRepository(User);

        if (alert.assignedUser?.id) {
            const assignedUser = await repository.findOne({
                where: {
                    id: alert.assignedUser.id,
                    tenant: { id: tenantId },
                    status: UserStatus.APPROVED,
                },
            });
            return assignedUser ? [assignedUser] : [];
        }

        return repository.createQueryBuilder("user")
            .innerJoinAndSelect("user.role", "role")
            .where("user.tenant_id = :tenantId", { tenantId })
            .andWhere("user.status = :status", { status: UserStatus.APPROVED })
            .andWhere(`(
                role.allowed_pages @> :alertWritePermission::jsonb
                OR role.allowed_pages @> :allWritePermission::jsonb
                OR role.allowed_pages @> :wildcardWritePermission::jsonb
                OR role.allowed_pages @> :legacyAlertWritePermission::jsonb
                OR role.allowed_pages @> :legacyAllPermission::jsonb
                OR role.allowed_pages @> :legacyWildcardPermission::jsonb
            )`, {
                alertWritePermission: JSON.stringify({ alerts: ["write"] }),
                allWritePermission: JSON.stringify({ all: ["write"] }),
                wildcardWritePermission: JSON.stringify({ "*": ["write"] }),
                legacyAlertWritePermission: JSON.stringify(["alerts:write"]),
                legacyAllPermission: JSON.stringify(["all"]),
                legacyWildcardPermission: JSON.stringify(["*"]),
            })
            .distinct(true)
            .getMany();
    }

    private static async addRecipients(
        manager: EntityManager,
        notification: Notification,
        recipients: User[],
    ): Promise<void> {
        if (recipients.length === 0) return;

        await manager.createQueryBuilder()
            .insert()
            .into(NotificationRecipient)
            .values(recipients.map((user) => ({
                notification: { id: notification.id },
                user: { id: user.id },
                readAt: null,
            })) as any)
            .orIgnore()
            .execute();
    }
}
