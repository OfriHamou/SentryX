import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { Event } from "../models/Event";
import { Tenant } from "../models/Tenant";

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

        return alert;
    }
}
