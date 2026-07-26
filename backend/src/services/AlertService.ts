import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { Event } from "../models/Event";
import { Tenant } from "../models/Tenant";
import { logger } from "../utils/logger";
import { NotificationService } from "./NotificationService";

export class AlertService {
    static shouldCreateForEventType(eventType: string | null | undefined): boolean {
        return typeof eventType === "string" && eventType.length > 0 && eventType !== "face_recognized";
    }

    static async createForEvent(eventId: string, tenantId: string): Promise<Alert> {
        const repository = AppDataSource.getRepository(Alert);

        await repository.createQueryBuilder()
            .insert()
            .into(Alert)
            .values({
                tenant: { id: tenantId } as Tenant,
                event: { id: eventId } as Event,
                status: AlertStatus.OPEN,
            } as any)
            .orIgnore()
            .execute();

        const alert = await repository.findOne({
            where: {
                tenant: { id: tenantId },
                event: { id: eventId },
            },
            relations: ["tenant", "event"],
        });

        if (!alert) {
            throw new Error(`Alert could not be created or found for event ${eventId}`);
        }
        try {
            await NotificationService.ensureForAlert(alert.id, tenantId);
        } catch (notificationError) {
            console.error(`Failed to create Notification for Alert ${alert.id}:`, notificationError);
            logger.error("Failed to create Notification for persisted Alert", notificationError, {
                category: "NOTIFICATIONS",
                action: "CREATE_NOTIFICATION_FOR_ALERT_FAILED",
                status: "FAILED",
                context: "AlertService.createForEvent",
                metadata: { alertId: alert.id, eventId, tenantId },
            });
        }

        return alert;
    }
}
