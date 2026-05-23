import axios from 'axios';
import { api, API_BASE_URL } from '../api';
import type { AuthUser } from './authTypes';

interface LoginResponse {
    accessToken: string;
    refreshToken?: string;
    user?: AuthUser;
}

interface MeResponse {
    user: AuthUser;
}

interface RefreshResponse {
    accessToken: string;
    refreshToken?: string;
    user?: AuthUser;
}

export const login = async (email: string, password: string) => {
    const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { email, password });
    return response.data;
};

export const getMe = async () => {
    const response = await api.get<MeResponse>('/auth/me');
    return response.data;
};

export const refresh = async (refreshToken: string) => {
    const response = await axios.post<RefreshResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    return response.data;
};

export const logout = async (refreshToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken });
    return response.data;
};
