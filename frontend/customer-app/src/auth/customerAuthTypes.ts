export interface CustomerAuthUser {
  id: string;
  email: string;
  fullName?: string | null;
  tenantId?: string | null;
  roleId?: number | string | null;
  roleName?: string | null;
  createdAt?: string;
  allowedPages?: Record<string, string[]>;
}

export interface CustomerAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CustomerAuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
}
