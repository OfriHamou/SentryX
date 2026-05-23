const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const LEGACY_TOKEN_KEY = 'token';

export const getStoredAccessToken = () => {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
};

export const getStoredRefreshToken = () => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setStoredTokens = (accessToken: string, refreshToken?: string | null) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.removeItem(LEGACY_TOKEN_KEY);

    if (typeof refreshToken === 'string') {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
};

export const clearStoredTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
};
