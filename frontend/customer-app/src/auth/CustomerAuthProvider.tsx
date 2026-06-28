import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CustomerAuthState, CustomerAuthUser } from './customerAuthTypes';
import {
  clearStoredCustomerTokens,
  getStoredCustomerAccessToken,
  getStoredCustomerRefreshToken,
  setStoredCustomerTokens,
} from './customerAuthStorage';
import * as customerAuthService from './customerAuthService';
import { setCustomerAuthCallbacks } from '../api/customerApi';

type PermissionAction = 'read' | 'write';

export const hasCustomerPermission = (
  allowedPages: Record<string, string[]> | undefined,
  resource: string,
  action: PermissionAction
): boolean => {
  if (!allowedPages) return false;

  const normalizedResource = resource.trim().toLowerCase();
  const wildcardActions = allowedPages['all'];

  if (Array.isArray(wildcardActions)) {
    const normalizedWildcardActions = wildcardActions.map((a) => a.toLowerCase());
    if (normalizedWildcardActions.includes(action) || normalizedWildcardActions.includes('all')) {
      return true;
    }
  }

  const resourceActions = allowedPages[normalizedResource];
  if (!Array.isArray(resourceActions)) return false;

  const normalizedResourceActions = resourceActions.map((a) => a.toLowerCase());
  return normalizedResourceActions.includes(action) || normalizedResourceActions.includes('all');
};

interface CustomerAuthContextValue extends CustomerAuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuthenticatedUser: (user: CustomerAuthUser | null) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

const buildState = (partial: Partial<CustomerAuthState>): CustomerAuthState => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  loading: true,
  ...partial,
});

export const CustomerAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<CustomerAuthState>(() =>
    buildState({
      accessToken: getStoredCustomerAccessToken(),
      refreshToken: getStoredCustomerRefreshToken(),
      loading: true,
    })
  );

  const setAuthenticatedUser = useCallback((user: CustomerAuthUser | null) => {
    setState((prev) => ({
      ...prev,
      user,
      isAuthenticated: Boolean(user),
    }));
  }, []);

  const clearAuthState = useCallback(() => {
    clearStoredCustomerTokens();
    setState(buildState({ loading: false }));
  }, []);

  const validateSession = useCallback(async () => {
    const accessToken = getStoredCustomerAccessToken();
    const refreshToken = getStoredCustomerRefreshToken();

    if (!accessToken) {
      setState(buildState({ loading: false, refreshToken }));
      return;
    }

    try {
      const { user } = await customerAuthService.getMe();
      setState(
        buildState({
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
          loading: false,
        })
      );
    } catch {
      clearAuthState();
    }
  }, [clearAuthState]);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  useEffect(() => {
    setCustomerAuthCallbacks({
      onAuthFailure: clearAuthState,
      onTokenRefresh: (accessToken, user, refreshToken) => {
        setState((prev) => ({
          ...prev,
          accessToken,
          refreshToken: refreshToken ?? prev.refreshToken,
          user: user ?? prev.user,
          isAuthenticated: Boolean(user ?? prev.user),
        }));
      },
    });
  }, [clearAuthState]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await customerAuthService.login(email, password);
    if (!response.accessToken) {
      throw new Error('Login failed');
    }

    const userObj = response.user ?? (await customerAuthService.getMe()).user;

    setStoredCustomerTokens(response.accessToken, response.refreshToken);

    setState(
      buildState({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? null,
        user: userObj,
        isAuthenticated: true,
        loading: false,
      })
    );
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredCustomerRefreshToken();
    if (refreshToken) {
      try {
        await customerAuthService.logout(refreshToken);
      } catch {
        // ignore logout errors
      }
    }

    clearAuthState();
  }, [clearAuthState]);

  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      setAuthenticatedUser,
    }),
    [login, logout, setAuthenticatedUser, state]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }

  return context;
};
