const CUSTOMER_ACCESS_TOKEN_KEY = 'customer_accessToken';
const CUSTOMER_REFRESH_TOKEN_KEY = 'customer_refreshToken';

export const getStoredCustomerAccessToken = () => {
  return localStorage.getItem(CUSTOMER_ACCESS_TOKEN_KEY);
};

export const getStoredCustomerRefreshToken = () => {
  return localStorage.getItem(CUSTOMER_REFRESH_TOKEN_KEY);
};

export const setStoredCustomerTokens = (accessToken: string, refreshToken?: string | null) => {
  localStorage.setItem(CUSTOMER_ACCESS_TOKEN_KEY, accessToken);

  if (typeof refreshToken === 'string') {
    localStorage.setItem(CUSTOMER_REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearStoredCustomerTokens = () => {
  localStorage.removeItem(CUSTOMER_ACCESS_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_REFRESH_TOKEN_KEY);
};
