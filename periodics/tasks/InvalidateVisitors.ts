import { PeriodicBase } from "../base/PeriodicBase";
import { AppDataSource } from "../../backend/src/db";
import { VisitorStatus } from "../../backend/src/models/Visitor";
import { FaceSyncService } from "../../backend/src/services/FaceSyncService";

export class InvalidateVisitors extends PeriodicBase {
    public readonly taskName = "InvalidateVisitors";
    public readonly intervalMinutes = 1; // Run each minute. do "0" to run all the time

    public async handle(tenantId: string): Promise<void> {
        const activeToExpired = await AppDataSource
            .createQueryBuilder()
            .update("visitors")
            .set({ status: VisitorStatus.EXPIRED })
            .where("tenant_id = :tenantId", { tenantId })
            .andWhere("status = :status", { status: VisitorStatus.ACTIVE })
            .andWhere("end_at <= NOW()")
            .execute();

        const scheduledToActive = await AppDataSource
            .createQueryBuilder()
            .update("visitors")
            .set({ status: VisitorStatus.ACTIVE })
            .where("tenant_id = :tenantId", { tenantId })
            .andWhere("status = :status", { status: VisitorStatus.SCHEDULED })
            .andWhere("start_at <= NOW()")
            .andWhere("end_at > NOW()")
            .execute();

        await AppDataSource
            .createQueryBuilder()
            .update("visitors")
            .set({ status: VisitorStatus.EXPIRED })
            .where("tenant_id = :tenantId", { tenantId })
            .andWhere("status = :status", { status: VisitorStatus.SCHEDULED })
            .andWhere("end_at <= NOW()")
            .execute();

        if ((activeToExpired.affected ?? 0) > 0 || (scheduledToActive.affected ?? 0) > 0) {
            FaceSyncService.notifyFacesChanged(tenantId);
        }
    }
}
