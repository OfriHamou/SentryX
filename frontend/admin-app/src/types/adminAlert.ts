export type AdminAlertStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type AdminAlertStatusFilter = 'all' | 'active' | 'open' | 'in_progress' | 'resolved';

export interface AdminAlertTenant {
    id: string;
    name: string;
}

export interface AdminAlertRobot {
    id: string;
    name: string;
    location: string | null;
    status: string;
}

export interface AdminAlertEvent {
    id: string;
    eventType: string | null;
    imagePath: string | null;
    aiMetadata: unknown;
    status: string;
    createdAt: string;
    robot: AdminAlertRobot | null;
}

export interface AdminAlertAssignedUser {
    id: string;
    fullName: string | null;
    email: string;
    jobTitle: string | null;
}

export interface AdminAlertAssignedShift {
    id: string;
    name: string;
    startAt: string;
    endAt: string;
    status: string;
}

export interface AdminAlertResolvedBy {
    id: string;
    fullName: string | null;
    email: string;
}

export interface AdminAlert {
    id: string;
    status: AdminAlertStatus;
    displayTitle: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    resolvedAt: string | null;
    resolutionNotes: string | null;
    tenant: AdminAlertTenant;
    assignedUser: AdminAlertAssignedUser | null;
    assignedShift: AdminAlertAssignedShift | null;
    resolvedBy: AdminAlertResolvedBy | null;
    event: AdminAlertEvent | null;
}

export interface AdminAlertCounts {
    all: number;
    open: number;
    inProgress: number;
    active: number;
    resolved: number;
    tenantsWithActive: number;
}

export interface AdminAlertsResponse {
    ok: true;
    alerts: AdminAlert[];
    counts: AdminAlertCounts;
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

export interface AdminAlertsQueryParams {
    status?: AdminAlertStatusFilter;
    tenantId?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export interface AdminUpdateAlertStatusInput {
    status: 'IN_PROGRESS' | 'RESOLVED';
    resolutionNotes?: string;
}
