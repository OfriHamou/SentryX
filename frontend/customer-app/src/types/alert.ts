export type AlertStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type AlertStatusFilter = 'all' | 'active' | 'resolved';

export interface AlertRobot {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

export interface AlertEvent {
  id: string;
  eventType: string;
  imagePath: string | null;
  aiMetadata: unknown;
  status: string;
  createdAt: string;
  robot: AlertRobot | null;
}

export interface AlertAssignedUser {
  id: string;
  fullName: string | null;
  email: string;
  jobTitle?: string | null;
}

export interface AlertAssignedShift {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
}

export interface Alert {
  id: string;
  status: AlertStatus;
  displayTitle: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  assignedUser: AlertAssignedUser | null;
  assignedShift: AlertAssignedShift | null;
  resolvedBy?: AlertAssignedUser | null;
  event: AlertEvent;
}

export interface AlertCounts {
  all: number;
  active: number;
  resolved: number;
}

export interface AlertPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface AlertsResponse {
  ok: true;
  alerts: Alert[];
  counts: AlertCounts;
  pagination: AlertPagination;
}

export interface AlertsQueryParams {
  status?: AlertStatusFilter;
  from?: string;
  to?: string;
  eventType?: string;
  robotId?: string;
  assignedUserId?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateAlertStatusInput {
  status: Extract<AlertStatus, 'IN_PROGRESS' | 'RESOLVED'>;
  resolutionNotes?: string;
}
