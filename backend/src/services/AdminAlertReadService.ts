import { SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../db";
import { Alert, AlertStatus } from "../models/Alert";
import { alertDisplayTitle } from "../utils/alertDisplayTitle";

export type AdminAlertStatusFilter = "all" | "active" | "open" | "in_progress" | "resolved";

export interface AdminAlertFilters {
    tenantId?: string;
    from?: Date;
    to?: Date;
    search?: string;
}

export function serializeAdminAlert(alert: Alert) {
    const event = alert.event;
    const robot = event?.robot;

    return {
        id: alert.id,
        status: alert.status,
        displayTitle: alertDisplayTitle(event?.eventType),
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
        startedAt: alert.startedAt,
        resolvedAt: alert.resolvedAt,
        resolutionNotes: alert.resolutionNotes,
        tenant: {
            id: alert.tenant.id,
            name: alert.tenant.name,
        },
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

export function hydratedAdminAlertQuery(): SelectQueryBuilder<Alert> {
    return AppDataSource.getRepository(Alert)
        .createQueryBuilder("alert")
        .innerJoinAndSelect("alert.tenant", "tenant")
        .innerJoinAndSelect("alert.event", "event")
        .leftJoinAndSelect("event.robot", "robot")
        .leftJoinAndSelect("alert.assignedUser", "assignedUser")
        .leftJoinAndSelect("alert.assignedShift", "assignedShift")
        .leftJoinAndSelect("alert.resolvedBy", "resolvedBy");
}

export function applyAdminAlertFilters(
    query: SelectQueryBuilder<Alert>,
    filters: AdminAlertFilters,
): SelectQueryBuilder<Alert> {
    if (filters.tenantId) query.andWhere("tenant.id = :tenantId", { tenantId: filters.tenantId });
    if (filters.from) query.andWhere("alert.created_at >= :from", { from: filters.from });
    if (filters.to) query.andWhere("alert.created_at <= :to", { to: filters.to });
    if (filters.search) {
        query.andWhere(
            `(
                CAST(alert.id AS text) ILIKE :search
                OR tenant.name ILIKE :search
                OR event.event_type ILIKE :search
                OR robot.name ILIKE :search
                OR robot.location ILIKE :search
                OR assignedUser.full_name ILIKE :search
                OR assignedUser.email ILIKE :search
            )`,
            { search: `%${filters.search}%` },
        );
    }
    return query;
}

export function applyAdminAlertStatus(
    query: SelectQueryBuilder<Alert>,
    status: AdminAlertStatusFilter,
): SelectQueryBuilder<Alert> {
    if (status === "active") {
        query.andWhere("alert.status IN (:...selectedStatuses)", {
            selectedStatuses: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS],
        });
    } else if (status !== "all") {
        const selectedStatus = status === "in_progress" ? AlertStatus.IN_PROGRESS : status.toUpperCase();
        query.andWhere("alert.status = :selectedStatus", { selectedStatus });
    }
    return query;
}

export function adminAlertCountsQuery(filters: AdminAlertFilters) {
    return applyAdminAlertFilters(hydratedAdminAlertQuery(), filters)
        .select("COUNT(alert.id)", "all")
        .addSelect("COUNT(alert.id) FILTER (WHERE alert.status = :openStatus)", "open")
        .addSelect("COUNT(alert.id) FILTER (WHERE alert.status = :inProgressStatus)", "inProgress")
        .addSelect("COUNT(alert.id) FILTER (WHERE alert.status IN (:...activeStatuses))", "active")
        .addSelect("COUNT(alert.id) FILTER (WHERE alert.status = :resolvedStatus)", "resolved")
        .addSelect(
            "COUNT(DISTINCT tenant.id) FILTER (WHERE alert.status IN (:...activeStatuses))",
            "tenantsWithActive",
        )
        .setParameters({
            openStatus: AlertStatus.OPEN,
            inProgressStatus: AlertStatus.IN_PROGRESS,
            activeStatuses: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS],
            resolvedStatus: AlertStatus.RESOLVED,
        });
}
