import axios from 'axios';
import { getAuthToken, getRefreshToken, setAuthTokens } from './auth/organizationAuthStorage';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(config => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = getRefreshToken();
            if (refreshToken) {
                try {
                    const { data } = await axios.post('/api/auth/refresh', { refreshToken });
                    setAuthTokens(data.accessToken, data.refreshToken);
                    api.defaults.headers.common['Authorization'] = 'Bearer ' + data.accessToken;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Redirect to login
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
        }
        return Promise.reject(error);
    }
);
