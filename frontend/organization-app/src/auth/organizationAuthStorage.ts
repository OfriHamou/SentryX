const AUTH_TOKEN_KEY = 'organization_auth_token';
const REFRESH_TOKEN_KEY = 'organization_refresh_token';

export const getAuthToken = (): string | null => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setAuthTokens = (authToken: string, refreshToken: string): void => {
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const removeAuthTokens = (): void => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
};
