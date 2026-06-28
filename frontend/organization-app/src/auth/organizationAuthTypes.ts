export interface OrganizationUser {
    id: string;
    email: string;
    fullName: string;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    roleId: string | number;
    roleName: string;
    allowedPages: Record<string, string[]>;
}

export interface Tenant {
    id: string;
    name: string;
    createdAt: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: OrganizationUser;
}
