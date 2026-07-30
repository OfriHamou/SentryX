import { api } from '../api';
import type {
    AdminAlert,
    AdminAlertsQueryParams,
    AdminAlertsResponse,
    AdminUpdateAlertStatusInput,
} from '../types/adminAlert';

interface AdminAlertResponse {
    ok: true;
    alert: AdminAlert;
}

export const getAdminAlerts = (
    params: AdminAlertsQueryParams,
    signal?: AbortSignal,
): Promise<AdminAlertsResponse> =>
    api.get<AdminAlertsResponse>('/admin/alerts', { params, signal }).then((response) => response.data);

export const getAdminAlert = (id: string, signal?: AbortSignal): Promise<AdminAlert> =>
    api.get<AdminAlertResponse>(`/admin/alerts/${id}`, { signal }).then((response) => response.data.alert);

export const updateAdminAlertStatus = (
    id: string,
    input: AdminUpdateAlertStatusInput,
): Promise<AdminAlert> =>
    api.patch<AdminAlertResponse>(`/admin/alerts/${id}/status`, input).then((response) => response.data.alert);

export const getAdminAlertImage = (id: string, signal?: AbortSignal): Promise<Blob> =>
    api.get<Blob>(`/admin/alerts/${id}/image`, {
        responseType: 'blob',
        signal,
    }).then((response) => response.data);
