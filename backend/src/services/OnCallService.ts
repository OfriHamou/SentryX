import { AppDataSource } from "../db";
import { Alert } from "../models/Alert";
import { SecurityShift, SecurityShiftStatus } from "../models/SecurityShift";
import { UserStatus } from "../models/User";
import {
    alertCountsQuery,
    applyAlertFilters,
    applyAlertTab,
    hydratedAlertQuery,
    serializeAlert,
    type AlertTab,
} from "./AlertReadService";

const SECURITY_OPERATOR_ROLE = "SECURITY_OPERATOR";

export interface OnCallTasksResult {
    alerts: ReturnType<typeof serializeAlert>[];
    counts: { all: number; active: number; resolved: number };
    pagination: { limit: number; offset: number; total: number };
}

export class OnCallService {
    static async findShiftCovering(tenantId: string, incidentAt: Date): Promise<SecurityShift | null> {
        return AppDataSource.getRepository(SecurityShift)
            .createQueryBuilder("shift")
            .innerJoinAndSelect("shift.assignedUser", "assignedUser")
            .innerJoinAndSelect("assignedUser.role", "role")
            .where("shift.tenant_id = :tenantId", { tenantId })
            .andWhere("shift.status != :cancelled", { cancelled: SecurityShiftStatus.CANCELLED })
            .andWhere("shift.start_at <= :incidentAt", { incidentAt })
            .andWhere("shift.end_at > :incidentAt", { incidentAt })
            .andWhere("assignedUser.tenant_id = :tenantId", { tenantId })
            .andWhere("assignedUser.status = :approved", { approved: UserStatus.APPROVED })
            .andWhere("role.role_name = :roleName", { roleName: SECURITY_OPERATOR_ROLE })
            .orderBy("shift.start_at", "DESC")
            .addOrderBy("shift.id", "ASC")
            .getOne();
    }

    static async assignAlert(alertId: string, tenantId: string): Promise<Alert> {
        const repository = AppDataSource.getRepository(Alert);
        const alert = await repository.findOne({
            where: { id: alertId, tenant: { id: tenantId } },
            relations: ["event", "assignedUser", "assignedShift"],
        });

        if (!alert) {
            throw new Error(`Alert ${alertId} was not found in tenant ${tenantId}`);
        }
        if (alert.assignedUser || alert.assignedShift) {
            return alert;
        }

        const shift = await this.findShiftCovering(tenantId, alert.event.createdAt);
        if (!shift) {
            return alert;
        }

        await repository.createQueryBuilder()
            .update(Alert)
            .set({
                assignedUser: { id: shift.assignedUser.id },
                assignedShift: { id: shift.id },
            })
            .where("id = :alertId", { alertId })
            .andWhere("tenant_id = :tenantId", { tenantId })
            .andWhere("assigned_user_id IS NULL")
            .andWhere("assigned_shift_id IS NULL")
            .execute();

        return repository.findOneOrFail({
            where: { id: alertId, tenant: { id: tenantId } },
            relations: ["event", "assignedUser", "assignedShift"],
        });
    }

    static async getCurrentShift(tenantId: string, userId: string, now = new Date()): Promise<SecurityShift | null> {
        return AppDataSource.getRepository(SecurityShift)
            .createQueryBuilder("shift")
            .innerJoinAndSelect("shift.assignedUser", "assignedUser")
            .where("shift.tenant_id = :tenantId", { tenantId })
            .andWhere("assignedUser.id = :userId", { userId })
            .andWhere("assignedUser.tenant_id = :tenantId", { tenantId })
            .andWhere("shift.status != :cancelled", { cancelled: SecurityShiftStatus.CANCELLED })
            .andWhere("shift.start_at <= :now", { now })
            .andWhere("shift.end_at > :now", { now })
            .orderBy("shift.start_at", "DESC")
            .addOrderBy("shift.id", "ASC")
            .getOne();
    }

    static async getTasks(
        tenantId: string,
        userId: string,
        status: AlertTab,
        limit: number,
        offset: number,
    ): Promise<OnCallTasksResult> {
        const filters = { assignedUserId: userId };
        const listQuery = applyAlertTab(
            applyAlertFilters(hydratedAlertQuery(tenantId), tenantId, filters),
            status,
        )
            .orderBy("alert.createdAt", "DESC")
            .take(limit)
            .skip(offset);

        const [[alerts, total], rawCounts] = await Promise.all([
            listQuery.getManyAndCount(),
            alertCountsQuery(tenantId, filters)
                .getRawOne<{ all: string; active: string; resolved: string }>(),
        ]);

        return {
            alerts: alerts.map(serializeAlert),
            counts: {
                all: Number(rawCounts?.all ?? 0),
                active: Number(rawCounts?.active ?? 0),
                resolved: Number(rawCounts?.resolved ?? 0),
            },
            pagination: { limit, offset, total },
        };
    }
}
