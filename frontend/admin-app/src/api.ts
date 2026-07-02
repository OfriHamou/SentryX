import axios from 'axios';
import type { AuthUser } from './auth/authTypes';
import { clearStoredTokens, getStoredAccessToken, getStoredRefreshToken, setStoredTokens } from './auth/authStorage';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
});

type AuthCallbacks = {
    onAuthFailure?: () => void;
    onTokenRefresh?: (accessToken: string, user?: AuthUser, refreshToken?: string) => void;
};

let authCallbacks: AuthCallbacks = {};

export const setAuthCallbacks = (callbacks: AuthCallbacks) => {
    authCallbacks = callbacks;
};

// Add authorization header to all requests
api.interceptors.request.use((config) => {
    const token = getStoredAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let refreshPromise: Promise<{ accessToken: string; refreshToken?: string; user?: AuthUser } | null> | null = null;

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
        const status = error?.response?.status;

        const isAuthRoute = typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/');

        if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
            const refreshToken = getStoredRefreshToken();
            if (!refreshToken) {
                clearStoredTokens();
                authCallbacks.onAuthFailure?.();
                return Promise.reject(error);
            }

            if (!refreshPromise) {
                refreshPromise = axios
                    .post<{ accessToken: string; refreshToken?: string; user?: AuthUser }>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
                    .then((response) => response.data)
                    .then((data) => {
                        if (!data?.accessToken) {
                            return null;
                        }

                        setStoredTokens(data.accessToken, data.refreshToken ?? refreshToken);
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
                clearStoredTokens();
                authCallbacks.onAuthFailure?.();
                return Promise.reject(error);
            }

            originalRequest._retry = true;
            originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${refreshed.accessToken}`
            };

            return api(originalRequest);
        }

        return Promise.reject(error);
    }
);

// Tenant endpoints
export const getTenants = () => api.get('/tenants').then(res => res.data);
export const createTenant = (name: string) => api.post('/tenants', { name }).then(res => res.data);
export const updateTenant = (id: string, name: string) => api.put(`/tenants/${id}`, { name }).then(res => res.data);
export const deleteTenant = (id: string) => api.delete(`/tenants/${id}`).then(res => res.data);

// License endpoints
export const addTenantLicense = (id: string, licenseCode: string, expirationDate?: string) =>
    api.post(`/tenants/${id}/licenses`, { licenseCode, expirationDate }).then(res => res.data);
export const removeTenantLicense = (id: string, licenseCode: string) =>
    api.delete(`/tenants/${id}/licenses/${licenseCode}`).then(res => res.data);

export const getLicenses = () => api.get('/licenses').then(res => res.data);

// Registration approval endpoints
export interface RegistrationRequest {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    jobTitle: string | null;
    status: string;
    createdAt: string;
    tenantId: string;
    tenantName: string;
    tenantInviteCode: string | null;
    roleId: number;
    roleName: string;
}

export interface Tenant {
    id: string;
    name: string;
    inviteCode: string | null;
    createdAt?: string;
    updatedAt?: string;
    tenantLicenses?: any[];
    robots?: any[];
}

export const getRegistrationRequests = () =>
    api.get('/auth/admin/registration-requests').then(res => res.data.registrationRequests);

export const approveRegistrationRequest = (userId: string) =>
    api.post(`/auth/admin/registration-requests/${userId}/approve`).then(res => res.data.user);

export const rejectRegistrationRequest = (userId: string, rejectionReason?: string) =>
    api.post(`/auth/admin/registration-requests/${userId}/reject`, { rejectionReason }).then(res => res.data.user);

// Dor comment - we need to implement this.
export const getAlerts = () => api.get('/alerts').then(res => res.data).catch(() => {
    // Return empty array if endpoint is not fully implemented on backend yet
    console.warn("Could not fetch alerts from /api/alerts");
    return [];
});


export const createLicense = (data: { code: string; description: string }) =>
    api.post('/licenses', data).then(res => res.data);

export const deleteLicense = (code: string) =>
    api.delete(`/licenses/${code}`).then(res => res.data);