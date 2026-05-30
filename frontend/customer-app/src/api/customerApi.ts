import axios from 'axios';
import type { CustomerAuthUser } from '../auth/customerAuthTypes';
import {
  clearStoredCustomerTokens,
  getStoredCustomerAccessToken,
  getStoredCustomerRefreshToken,
  setStoredCustomerTokens,
} from '../auth/customerAuthStorage';

export const CUSTOMER_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const customerApi = axios.create({
  baseURL: CUSTOMER_API_BASE_URL,
});

type AuthCallbacks = {
  onAuthFailure?: () => void;
  onTokenRefresh?: (accessToken: string, user?: CustomerAuthUser, refreshToken?: string) => void;
};

let authCallbacks: AuthCallbacks = {};

export const setCustomerAuthCallbacks = (callbacks: AuthCallbacks) => {
  authCallbacks = callbacks;
};

customerApi.interceptors.request.use((config) => {
  const token = getStoredCustomerAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<{ accessToken: string; refreshToken?: string; user?: CustomerAuthUser } | null> | null = null;

customerApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error?.response?.status;
    const isAuthRoute = typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      const refreshToken = getStoredCustomerRefreshToken();
      if (!refreshToken) {
        clearStoredCustomerTokens();
        authCallbacks.onAuthFailure?.();
        return Promise.reject(error);
      }

      if (!refreshPromise) {
        refreshPromise = axios
          .post<{ accessToken: string; refreshToken?: string; user?: CustomerAuthUser }>(
            `${CUSTOMER_API_BASE_URL}/auth/refresh`,
            { refreshToken }
          )
          .then((response) => response.data)
          .then((data) => {
            if (!data?.accessToken) {
              return null;
            }

            setStoredCustomerTokens(data.accessToken, data.refreshToken ?? refreshToken);
            authCallbacks.onTokenRefresh?.(data.accessToken, data.user, data.refreshToken ?? refreshToken);
            return data;
          })
          .catch(() => null)
          .finally(() => {
            refreshPromise = null;
          });
      }

      const refreshed = await refreshPromise;
      if (!refreshed?.accessToken) {
        clearStoredCustomerTokens();
        authCallbacks.onAuthFailure?.();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${refreshed.accessToken}`,
      };

      return customerApi(originalRequest);
    }

    return Promise.reject(error);
  }
);
