export interface AuthIdentityPayload {
    userId: string;
    tenantId: string;
    roleId: number;
    roleName?: string;
}

export type AuthTokenType = "access" | "refresh";

export interface RefreshTokenPayload extends AuthIdentityPayload {
    sessionId: string;
}
