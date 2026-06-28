import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { getAuthToken, removeAuthTokens, setAuthTokens } from './organizationAuthStorage';
import { organizationAuthService } from './organizationAuthService';
import { OrganizationUser, Tenant } from './organizationAuthTypes';
import { hasOrganizationPermission } from './permissions';

const PORTAL_ACCESS_ERROR = 'You do not have permission to access the Organization Portal.';

interface AuthContextType {
    isAuthenticated: boolean;
    user: OrganizationUser | null;
    tenant: Tenant | null;
    isLoading: boolean;
    authError: string;
    login: (password: string, email: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const OrganizationAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<OrganizationUser | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    const applyAuthenticatedUser = (currentUser: OrganizationUser, currentTenant: Tenant) => {
        if (!hasOrganizationPermission(currentUser.allowedPages, 'organization_portal', 'read')) {
            removeAuthTokens();
            setUser(null);
            setTenant(null);
            setAuthError(PORTAL_ACCESS_ERROR);
            throw new Error(PORTAL_ACCESS_ERROR);
        }

        setUser(currentUser);
        setTenant(currentTenant);
        setAuthError('');
    };

    useEffect(() => {
        const verifyUser = async () => {
            const token = getAuthToken();
            if (token) {
                try {
                    const { currentUser, tenant } = await organizationAuthService.me();
                    applyAuthenticatedUser(currentUser, tenant);
                } catch {
                    removeAuthTokens();
                    setUser(null);
                    setTenant(null);
                    setAuthError(PORTAL_ACCESS_ERROR);
                }
            }
            setIsLoading(false);
        };
        verifyUser();
    }, []);

    const login = async (password: string, email: string) => {
        // The login response from /api/auth/login doesn't have the full org data.
        // So we login, set tokens, then call me() to get the full context.
        const { accessToken, refreshToken } = await organizationAuthService.login(email, password);
        setAuthTokens(accessToken, refreshToken);
        try {
            const { currentUser, tenant } = await organizationAuthService.me();
            applyAuthenticatedUser(currentUser, tenant);
        } catch {
            removeAuthTokens();
            setUser(null);
            setTenant(null);
            setAuthError(PORTAL_ACCESS_ERROR);
            throw new Error(PORTAL_ACCESS_ERROR);
        }
    };

    const logout = async () => {
        try {
            await organizationAuthService.logout();
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            removeAuthTokens();
            setUser(null);
            setTenant(null);
            setAuthError('');
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated: !!user, user, tenant, isLoading, authError, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useOrganizationAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useOrganizationAuth must be used within an OrganizationAuthProvider');
    }
    return context;
};
