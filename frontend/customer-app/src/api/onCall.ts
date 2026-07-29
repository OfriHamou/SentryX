import { customerApi } from './customerApi';
import type {
  CurrentDutyResponse,
  OnCallTasksQuery,
  OnCallTasksResponse,
} from '../types/onCall';

export const getCurrentDuty = async (signal?: AbortSignal): Promise<CurrentDutyResponse> => {
  const response = await customerApi.get<CurrentDutyResponse>('/on-call/me', { signal });
  return response.data;
};

export const getOnCallTasks = async (
  params: OnCallTasksQuery,
  signal?: AbortSignal,
): Promise<OnCallTasksResponse> => {
  const response = await customerApi.get<OnCallTasksResponse>('/on-call/tasks', {
    params,
    signal,
  });
  return response.data;
};
