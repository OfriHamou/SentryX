import { api } from '../api';
import { getRefreshToken } from './organizationAuthStorage';
import { AuthResponse, OrganizationUser, Tenant } from './organizationAuthTypes';

const login = async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
};

const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
    }
};

const me = async (): Promise<{ currentUser: OrganizationUser, tenant: Tenant }> => {
    const { data } = await api.get('/organization/me');
    return data;
};

export const organizationAuthService = {
    login,
    logout,
    me,
};
