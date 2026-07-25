import { customerApi } from './customerApi';
import type {
  Alert,
  AlertsQueryParams,
  AlertsResponse,
  UpdateAlertStatusInput,
} from '../types/alert';

interface AlertResponse {
  ok: true;
  alert: Alert;
}

export const getAlerts = async (
  params: AlertsQueryParams,
  signal?: AbortSignal,
): Promise<AlertsResponse> => {
  const response = await customerApi.get<AlertsResponse>('/alerts', { params, signal });
  return response.data;
};

export const getAlert = async (id: string, signal?: AbortSignal): Promise<Alert> => {
  const response = await customerApi.get<AlertResponse>(`/alerts/${encodeURIComponent(id)}`, { signal });
  return response.data.alert;
};

export const updateAlertStatus = async (
  id: string,
  input: UpdateAlertStatusInput,
): Promise<Alert> => {
  const response = await customerApi.patch<AlertResponse>(
    `/alerts/${encodeURIComponent(id)}/status`,
    input,
  );
  return response.data.alert;
};
