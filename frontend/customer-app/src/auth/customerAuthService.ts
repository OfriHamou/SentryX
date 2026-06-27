import axios from 'axios';
import { customerApi, CUSTOMER_API_BASE_URL } from '../api/customerApi';
import type { CustomerAuthUser } from './customerAuthTypes';

interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user?: CustomerAuthUser;
}

interface MeResponse {
  user: CustomerAuthUser;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  user?: CustomerAuthUser;
}

interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
  tenantInviteCode: string;
  phone?: string;
  jobTitle?: string;
}

interface RegisterResponse {
  message: string;
  status: string;
}

export const login = async (email: string, password: string) => {
  const response = await axios.post<LoginResponse>(`${CUSTOMER_API_BASE_URL}/auth/login`, { email, password });
  return response.data;
};

export const register = async (payload: RegisterRequest) => {
  const response = await axios.post<RegisterResponse>(`${CUSTOMER_API_BASE_URL}/auth/register`, payload);
  return response.data;
};

export const getMe = async () => {
  const response = await customerApi.get<MeResponse>('/auth/me');
  return response.data;
};

export const refresh = async (refreshToken: string) => {
  const response = await axios.post<RefreshResponse>(`${CUSTOMER_API_BASE_URL}/auth/refresh`, { refreshToken });
  return response.data;
};

export const logout = async (refreshToken: string) => {
  const response = await axios.post(`${CUSTOMER_API_BASE_URL}/auth/logout`, { refreshToken });
  return response.data;
};
