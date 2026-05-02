import jwt from "jsonwebtoken";
import type { AuthIdentityPayload, RefreshTokenPayload } from "../types";

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("Missing required JWT_SECRET env variable");
    }
    return secret;
}

function getRefreshJwtSecret(): string {
    return process.env.JWT_REFRESH_SECRET || getJwtSecret();
}

export interface VerifiedRefreshTokenPayload extends RefreshTokenPayload {
    expiresAt: Date;
}

export function signAccessToken(payload: AuthIdentityPayload): string {
    const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m";

    return jwt.sign({ ...payload, type: "access" }, getJwtSecret(), {
        expiresIn: expiresIn as jwt.SignOptions["expiresIn"]
    });
}

export function verifyAccessToken(token: string): AuthIdentityPayload {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & Partial<AuthIdentityPayload>;

    if (decoded.type && decoded.type !== "access") {
        throw new Error("Invalid access token type");
    }

    if (!decoded.userId || !decoded.tenantId || typeof decoded.roleId !== "number") {
        throw new Error("Invalid authentication token payload");
    }

    return {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        roleId: decoded.roleId,
        roleName: decoded.roleName
    };
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

    return jwt.sign({ ...payload, type: "refresh" }, getRefreshJwtSecret(), {
        expiresIn: expiresIn as jwt.SignOptions["expiresIn"]
    });
}

export function verifyRefreshToken(token: string): VerifiedRefreshTokenPayload {
    const decoded = jwt.verify(token, getRefreshJwtSecret()) as jwt.JwtPayload & Partial<RefreshTokenPayload>;

    if (decoded.type !== "refresh") {
        throw new Error("Invalid refresh token type");
    }

    if (!decoded.sessionId || !decoded.userId || !decoded.tenantId || typeof decoded.roleId !== "number") {
        throw new Error("Invalid refresh token payload");
    }

    if (typeof decoded.exp !== "number") {
        throw new Error("Refresh token is missing expiry");
    }

    return {
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        roleId: decoded.roleId,
        roleName: decoded.roleName,
        expiresAt: new Date(decoded.exp * 1000)
    };
}

// Backwards-compatible alias retained for existing access-token call sites.
export const signAuthToken = signAccessToken;
// Backwards-compatible alias retained for existing access-token middleware call sites.
export const verifyAuthToken = verifyAccessToken;
