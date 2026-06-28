import axios from 'axios';
import { getStoredCustomerAccessToken } from '../auth/customerAuthStorage';

const baseURL = import.meta.env.VITE_ROBOT_API_URL;

if (!baseURL) {
  throw new Error(
    'VITE_ROBOT_API_URL is not set. Check .env file in customer-app/'
  );
}

export const robotApi = axios.create({
  baseURL,
  timeout: 5000,
});

robotApi.interceptors.request.use((config) => {
  const token = getStoredCustomerAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
