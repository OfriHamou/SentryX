export interface AuthUser {
    id: string;
    email: string;
    fullName?: string | null;
    tenantId?: string | null;
    roleId?: number | string | null;
    roleName?: string | null;
    createdAt?: string;
    allowedPages?: Record<string, string[]>;
}

export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;
    isAuthenticated: boolean;
    loading: boolean;
}
