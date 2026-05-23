import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthState, AuthUser } from './authTypes';
import { clearStoredTokens, getStoredAccessToken, getStoredRefreshToken, setStoredTokens } from './authStorage';
import * as authApi from './authApi';
import { setAuthCallbacks } from '../api';

type PermissionAction = 'read' | 'write';

export function hasPermission(
    allowedPages: Record<string, string[]> | undefined,
    resource: string,
    action: PermissionAction
): boolean {
    if (!allowedPages) return false;

    const normalizedResource = resource.trim().toLowerCase();

    const wildcardActions = allowedPages['all'];
    if (Array.isArray(wildcardActions) && wildcardActions.map(a => a.toLowerCase()).includes('read')) {
        return true;
    }

    const resourceActions = allowedPages[normalizedResource];
    if (!Array.isArray(resourceActions)) return false;

    return resourceActions.map(a => a.toLowerCase()).includes(action);
}

interface AuthContextValue extends AuthState {
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setAuthenticatedUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildState = (partial: Partial<AuthState>): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    loading: true,
    ...partial
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState<AuthState>(() =>
        buildState({
            accessToken: getStoredAccessToken(),
            refreshToken: getStoredRefreshToken(),
            loading: true
        })
    );

    const setAuthenticatedUser = useCallback((user: AuthUser | null) => {
        setState((prev) => ({
            ...prev,
            user,
            isAuthenticated: Boolean(user)
        }));
    }, []);

    const clearAuthState = useCallback(() => {
        clearStoredTokens();
        setState(buildState({ loading: false }));
    }, []);

    const validateSession = useCallback(async () => {
        const accessToken = getStoredAccessToken();
        const refreshToken = getStoredRefreshToken();

        if (!accessToken) {
            setState(buildState({ loading: false, refreshToken }));
            return;
        }

        try {
            const { user } = await authApi.getMe();
            
            if (!user?.roleName?.toLowerCase().includes('admin')) {
                clearAuthState();
                return;
            }

            setState(buildState({
                accessToken,
                refreshToken,
                user,
                isAuthenticated: true,
                loading: false
            }));
        } catch {
            clearAuthState();
        }
    }, [clearAuthState]);

    useEffect(() => {
        validateSession();
    }, [validateSession]);

    useEffect(() => {
        setAuthCallbacks({
            onAuthFailure: clearAuthState,
            onTokenRefresh: (accessToken, user, refreshToken) => {
                setState((prev) => ({
                    ...prev,
                    accessToken,
                    refreshToken: refreshToken ?? prev.refreshToken,
                    user: user ?? prev.user,
                    isAuthenticated: Boolean(user ?? prev.user)
                }));
            }
        });
    }, [clearAuthState]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await authApi.login(email, password);
        if (!response.accessToken) {
            throw new Error('Login failed');
        }

        const userObj = response.user ?? (await authApi.getMe()).user;

        if (!hasPermission(userObj?.allowedPages, 'admin_portal', 'read')) {
            clearAuthState();
            throw new Error('Access denied: You do not have permission to access the Admin portal.');
        }

        setStoredTokens(response.accessToken, response.refreshToken);

        setState(buildState({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken ?? null,
            user: userObj,
            isAuthenticated: true,
            loading: false
        }));
    }, []);

    const logout = useCallback(async () => {
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
            try {
                await authApi.logout(refreshToken);
            } catch {
                // ignore logout errors
            }
        }

        clearAuthState();
    }, [clearAuthState]);

    const value = useMemo<AuthContextValue>(() => ({
        ...state,
        login,
        logout,
        setAuthenticatedUser
    }), [login, logout, setAuthenticatedUser, state]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context;
};
