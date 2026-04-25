import crypto from "crypto";
import { AppDataSource } from "../../db";
import { RefreshTokenSession } from "../../models/RefreshTokenSession";
import { User } from "../../models/User";
import { signRefreshToken, verifyRefreshToken } from "./token";
import type { AuthIdentityPayload } from "../types";

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export interface RefreshValidationResult {
    user: User;
    session: RefreshTokenSession;
    payload: AuthIdentityPayload;
}

export async function issueRefreshTokenSession(user: User, payload: AuthIdentityPayload): Promise<string> {
    const sessionRepo = AppDataSource.getRepository(RefreshTokenSession);
    const sessionId = crypto.randomUUID();
    const refreshToken = signRefreshToken({
        sessionId,
        userId: payload.userId,
        tenantId: payload.tenantId,
        roleId: payload.roleId,
        roleName: payload.roleName
    });

    const verified = verifyRefreshToken(refreshToken);
    const session = sessionRepo.create({
        id: sessionId,
        user,
        tokenHash: hashToken(refreshToken),
        isActive: true,
        expiresAt: verified.expiresAt
    });
    await sessionRepo.save(session);

    return refreshToken;
}

export async function validateRefreshTokenSession(refreshToken: string): Promise<RefreshValidationResult> {
    const decoded = verifyRefreshToken(refreshToken);
    const sessionRepo = AppDataSource.getRepository(RefreshTokenSession);

    const session = await sessionRepo.findOne({
        where: { id: decoded.sessionId },
        relations: ["user", "user.tenant", "user.role"]
    });

    if (!session || !session.isActive) {
        throw new Error("Invalid refresh token session");
    }

    if (session.user.id !== decoded.userId) {
        throw new Error("Refresh token does not match user session");
    }

    if (session.tokenHash !== hashToken(refreshToken)) {
        throw new Error("Refresh token hash mismatch");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
        throw new Error("Refresh token session expired");
    }

    return {
        user: session.user,
        session,
        payload: {
            userId: session.user.id,
            tenantId: session.user.tenant.id,
            roleId: session.user.role.id,
            roleName: session.user.role.roleName
        }
    };
}

export async function revokeRefreshTokenSession(refreshToken: string): Promise<void> {
    const decoded = verifyRefreshToken(refreshToken);
    const sessionRepo = AppDataSource.getRepository(RefreshTokenSession);

    const session = await sessionRepo.findOneBy({ id: decoded.sessionId });
    if (!session || !session.isActive) {
        throw new Error("Invalid refresh token session");
    }

    session.isActive = false;
    await sessionRepo.save(session);
}
