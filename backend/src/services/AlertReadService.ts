import { SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { alertDisplayTitle } from "../utils/alertDisplayTitle";

export type AlertTab = "all" | "active" | "resolved";

export interface AlertFilters {
    from?: Date;
    to?: Date;
    eventType?: string;
    robotId?: string;
    assignedUserId?: string;
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

export function hydratedAlertQuery(tenantId: string): SelectQueryBuilder<Alert> {
    return AppDataSource.getRepository(Alert)
        .createQueryBuilder("alert")
        .innerJoinAndSelect("alert.event", "event", "event.tenant_id = :tenantId", { tenantId })
        .innerJoinAndSelect("event.robot", "robot", "robot.tenant_id = :tenantId", { tenantId })
        .leftJoinAndSelect("alert.assignedUser", "assignedUser", "assignedUser.tenant_id = :tenantId", { tenantId })
        .leftJoinAndSelect("alert.assignedShift", "assignedShift", "assignedShift.tenant_id = :tenantId", { tenantId })
        .leftJoinAndSelect("alert.resolvedBy", "resolvedBy", "resolvedBy.tenant_id = :tenantId", { tenantId });
}

export function applyAlertFilters(
    query: SelectQueryBuilder<Alert>,
    tenantId: string,
    filters: AlertFilters,
): SelectQueryBuilder<Alert> {
    query.where("alert.tenant_id = :tenantId", { tenantId });
    if (filters.from) query.andWhere("alert.created_at >= :from", { from: filters.from });
    if (filters.to) query.andWhere("alert.created_at <= :to", { to: filters.to });
    if (filters.eventType) query.andWhere("event.event_type = :eventType", { eventType: filters.eventType });
    if (filters.robotId) query.andWhere("event.robot_id = :robotId", { robotId: filters.robotId });
    if (filters.assignedUserId) {
        query.andWhere("alert.assigned_user_id = :assignedUserId", { assignedUserId: filters.assignedUserId });
    }
    return query;
}

export function applyAlertTab(query: SelectQueryBuilder<Alert>, tab: AlertTab): SelectQueryBuilder<Alert> {
    if (tab === "active") {
        query.andWhere("alert.status IN (:...activeStatuses)", {
            activeStatuses: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS],
        });
    } else if (tab === "resolved") {
        query.andWhere("alert.status = :resolvedStatus", { resolvedStatus: AlertStatus.RESOLVED });
    }
    return query;
}

export function alertCountsQuery(tenantId: string, filters: AlertFilters) {
    return applyAlertFilters(hydratedAlertQuery(tenantId), tenantId, filters)
        .select("COUNT(alert.id)", "all")
        .addSelect("COUNT(alert.id) FILTER (WHERE alert.status IN (:...activeStatuses))", "active")
        .addSelect("COUNT(alert.id) FILTER (WHERE alert.status = :resolvedStatus)", "resolved")
        .setParameters({
            activeStatuses: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS],
            resolvedStatus: AlertStatus.RESOLVED,
        });
}
