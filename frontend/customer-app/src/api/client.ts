import axios from 'axios';

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
