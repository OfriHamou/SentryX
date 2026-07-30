import { api } from '../api';
import type {
    AdminAnalyticsQueryParams,
    AdminAnalyticsResponse,
} from '../types/adminAnalytics';

export const getAdminAnalytics = (
    params: AdminAnalyticsQueryParams,
    signal?: AbortSignal,
): Promise<AdminAnalyticsResponse> =>
    api.get<AdminAnalyticsResponse>('/admin/analytics', { params, signal })
        .then((response) => response.data);
