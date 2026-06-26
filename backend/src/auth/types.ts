import { UserStatus } from "../models/User";

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

export interface RegistrationRequestDTO {
    tenantInviteCode: string;
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    jobTitle?: string;
}

export interface RegistrationResponse {
    message: string;
    status: UserStatus;
}

export interface ApprovalResponse {
    id: string;
    email: string;
    fullName: string | null;
    status: UserStatus;
    approvedAt: Date | null;
    approvedBy: string | null;
    tenantId: string;
    roleId: number;
    roleName: string;
}

export interface RejectionRequest {
    rejectionReason?: string;
}

export interface RejectionResponse {
    id: string;
    email: string;
    fullName: string | null;
    status: UserStatus;
    rejectedAt: Date | null;
    rejectedBy: string | null;
    rejectionReason: string | null;
    tenantId: string;
}
