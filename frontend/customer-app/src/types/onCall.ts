import type {
  Alert,
  AlertCounts,
  AlertPagination,
  AlertStatusFilter,
} from './alert';

export interface CurrentSecurityShift {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
}

export interface CurrentDutyResponse {
  ok: true;
  isOnCall: boolean;
  currentShift: CurrentSecurityShift | null;
}

export interface OnCallTasksResponse {
  ok: true;
  alerts: Alert[];
  counts: AlertCounts;
  pagination: AlertPagination;
}

export interface OnCallTasksQuery {
  status?: AlertStatusFilter;
  limit?: number;
  offset?: number;
}
