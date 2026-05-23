import { Request, Response } from "express";
import { QueryFailedError } from "typeorm";
import { AppDataSource } from "../db";
import { User } from "../models/User";
import { Tenant } from "../models/Tenant";
import { Role } from "../models/Role";
import { signAccessToken } from "../auth/services/token";
import { hashPassword, verifyPassword } from "../auth/services/password";
import {
    issueRefreshTokenSession,
    revokeRefreshTokenSession,
    validateRefreshTokenSession
} from "../auth/services/refreshTokenService";
import type { AuthIdentityPayload } from "../auth/types";
import { logger } from "../utils/logger";

interface RegisterRequestBody {
    email?: string;
    password?: string;
    fullName?: string;
    tenantId?: string;
    roleId?: number | string;
}

interface LoginRequestBody {
    email?: string;
    password?: string;
}

interface RefreshRequestBody {
    refreshToken?: string;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeUser(user: User) {
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenant?.id,
        roleId: user.role?.id,
        roleName: user.role?.roleName,
        createdAt: user.createdAt,
        allowedPages: user.role?.allowedPages ?? {},
    };
}

function getRequestId(req: Request): string | undefined {
    const header = req.headers["x-request-id"];
    if (typeof header === "string" && header.trim().length > 0) {
        return header.trim();
    }

    if (Array.isArray(header) && typeof header[0] === "string" && header[0].trim().length > 0) {
        return header[0].trim();
    }

    return undefined;
}

function buildAuthMeta(
    req: Request,
    base: Record<string, unknown>,
    auth?: AuthIdentityPayload
): Record<string, unknown> {
    const meta: Record<string, unknown> = {
        ...base,
        context: "AuthController",
        requestId: getRequestId(req)
    };

    if (req.ip) {
        meta.ip = req.ip;
    }

    const userAgent = req.get("user-agent");
    if (userAgent) {
        meta.userAgent = userAgent;
    }

    if (auth?.userId) {
        meta.userId = auth.userId;
    }

    return meta;
}

export class AuthController {
    static async register(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, fullName, tenantId, roleId } = req.body as RegisterRequestBody;

            if (!email || !isValidEmail(email)) {
                res.status(400).json({ message: "A valid email is required" });
                return;
            }

            if (!password) {
                res.status(400).json({ message: "Password is required" });
                return;
            }

            if (!tenantId) {
                res.status(400).json({ message: "tenantId is required" });
                return;
            }

            const numericRoleId = Number(roleId);
            if (!roleId || Number.isNaN(numericRoleId)) {
                res.status(400).json({ message: "roleId is required and must be numeric" });
                return;
            }

            const normalizedEmail = email.trim().toLowerCase();
            const userRepo = AppDataSource.getRepository(User);
            const tenantRepo = AppDataSource.getRepository(Tenant);
            const roleRepo = AppDataSource.getRepository(Role);

            const existingUser = await userRepo.findOne({ where: { email: normalizedEmail } });
            if (existingUser) {
                logger.warn("Register failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "REGISTER_FAILED",
                    status: "FAILED",
                    metadata: {
                        email: normalizedEmail,
                        reason: "EMAIL_ALREADY_REGISTERED"
                    }
                }));
                res.status(409).json({ message: "Email is already registered" });
                return;
            }

            const tenant = await tenantRepo.findOneBy({ id: tenantId });
            if (!tenant) {
                logger.warn("Register failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "REGISTER_FAILED",
                    status: "FAILED",
                    metadata: {
                        email: normalizedEmail,
                        tenantId,
                        reason: "TENANT_NOT_FOUND"
                    }
                }));
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            const role = await roleRepo.findOneBy({ id: numericRoleId });
            if (!role) {
                logger.warn("Register failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "REGISTER_FAILED",
                    status: "FAILED",
                    metadata: {
                        email: normalizedEmail,
                        roleId: numericRoleId,
                        reason: "ROLE_NOT_FOUND"
                    }
                }));
                res.status(404).json({ message: "Role not found" });
                return;
            }

            const passwordHash = await hashPassword(password);
            const newUserData: Partial<User> = {
                email: normalizedEmail,
                passwordHash,
                tenant,
                role
            };

            if (typeof fullName === "string" && fullName.trim().length > 0) {
                newUserData.fullName = fullName.trim();
            }

            const createdUser = userRepo.create(newUserData);
            const savedUser = await userRepo.save(createdUser);

            const userWithRelations = await userRepo.findOne({
                where: { id: savedUser.id },
                relations: ["tenant", "role"]
            });

            if (!userWithRelations) {
                logger.error("Register failed", undefined, buildAuthMeta(req, {
                    category: "AUTH",
                    action: "REGISTER_FAILED",
                    status: "FAILED",
                    metadata: {
                        email: normalizedEmail,
                        reason: "USER_RELOAD_FAILED"
                    }
                }));
                res.status(500).json({ message: "Unable to load created user" });
                return;
            }

            logger.info("Register success", buildAuthMeta(req, {
                category: "AUTH",
                action: "REGISTER_SUCCESS",
                status: "SUCCESS",
                userId: userWithRelations.id,
                metadata: {
                    email: userWithRelations.email,
                    tenantId: userWithRelations.tenant?.id,
                    roleId: userWithRelations.role?.id
                }
            }));

            res.status(201).json({ user: sanitizeUser(userWithRelations) });
        } catch (error: unknown) {
            if (error instanceof QueryFailedError) {
                const dbError = error as QueryFailedError & { driverError?: { code?: string } };
                if (dbError.driverError?.code === "23505") {
                    logger.warn("Register failed", buildAuthMeta(req, {
                        category: "AUTH",
                        action: "REGISTER_FAILED",
                        status: "FAILED",
                        metadata: {
                            reason: "EMAIL_ALREADY_REGISTERED"
                        }
                    }));
                    res.status(409).json({ message: "Email is already registered" });
                    return;
                }
            }

            logger.error("Register failed", error, buildAuthMeta(req, {
                category: "AUTH",
                action: "REGISTER_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "UNEXPECTED_ERROR"
                }
            }));
            console.error("Error registering user:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body as LoginRequestBody;

            if (!email || !isValidEmail(email)) {
                res.status(400).json({ message: "A valid email is required" });
                return;
            }

            if (!password) {
                res.status(400).json({ message: "Password is required" });
                return;
            }

            const normalizedEmail = email.trim().toLowerCase();
            logger.info("Login attempt", buildAuthMeta(req, {
                category: "AUTH",
                action: "LOGIN_ATTEMPT",
                status: "ATTEMPT",
                metadata: {
                    email: normalizedEmail
                }
            }));
            const userRepo = AppDataSource.getRepository(User);

            const user = await userRepo.findOne({
                where: { email: normalizedEmail },
                relations: ["tenant", "role"]
            });

            if (!user) {
                logger.warn("Login failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "LOGIN_FAILED",
                    status: "FAILED",
                    metadata: {
                        email: normalizedEmail,
                        reason: "USER_NOT_FOUND"
                    }
                }));
                res.status(401).json({ message: "Invalid credentials" });
                return;
            }

            const isPasswordValid = await verifyPassword(password, user.passwordHash);
            if (!isPasswordValid) {
                logger.warn("Login failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "LOGIN_FAILED",
                    status: "FAILED",
                    userId: user.id,
                    metadata: {
                        email: normalizedEmail,
                        reason: "INVALID_PASSWORD"
                    }
                }));
                res.status(401).json({ message: "Invalid credentials" });
                return;
            }

            const payload: AuthIdentityPayload = {
                userId: user.id,
                tenantId: user.tenant.id,
                roleId: user.role.id,
                roleName: user.role.roleName
            };

            const accessToken = signAccessToken(payload);
            const refreshToken = await issueRefreshTokenSession(user, payload);

            logger.info("Login success", buildAuthMeta(req, {
                category: "AUTH",
                action: "LOGIN_SUCCESS",
                status: "SUCCESS",
                userId: user.id,
                metadata: {
                    email: user.email,
                    tenantId: user.tenant.id,
                    roleId: user.role.id
                }
            }, payload));

            res.status(200).json({
                accessToken,
                refreshToken,
                user: sanitizeUser(user)
            });
        } catch (error) {
            logger.error("Login failed", error, buildAuthMeta(req, {
                category: "AUTH",
                action: "LOGIN_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "INVALID_CREDENTIALS"
                }
            }));
            console.error("Error logging in user:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async refresh(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body as RefreshRequestBody;

            if (!refreshToken || typeof refreshToken !== "string") {
                logger.warn("Refresh failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "REFRESH_FAILED",
                    status: "FAILED",
                    metadata: {
                        reason: "REFRESH_TOKEN_REQUIRED"
                    }
                }));
                res.status(401).json({ message: "Refresh token is required" });
                return;
            }

            const { payload, user } = await validateRefreshTokenSession(refreshToken.trim());
            const accessToken = signAccessToken(payload);

            logger.info("Refresh success", buildAuthMeta(req, {
                category: "AUTH",
                action: "REFRESH_SUCCESS",
                status: "SUCCESS",
                userId: payload.userId,
                metadata: {
                    tenantId: payload.tenantId,
                    roleId: payload.roleId
                }
            }, payload));

            res.status(200).json({
                accessToken,
                refreshToken: refreshToken.trim(),
                user: sanitizeUser(user)
            });
        } catch (error: unknown) {
            if (error instanceof Error && /refresh token|session/i.test(error.message)) {
                logger.warn("Refresh failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "REFRESH_FAILED",
                    status: "FAILED",
                    metadata: {
                        reason: "INVALID_REFRESH_TOKEN"
                    }
                }));
                res.status(401).json({ message: "Invalid or expired refresh token" });
                return;
            }

            logger.error("Refresh failed", error, buildAuthMeta(req, {
                category: "AUTH",
                action: "REFRESH_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "UNEXPECTED_ERROR"
                }
            }));
            console.error("Error refreshing access token:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async logout(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body as RefreshRequestBody;

            if (!refreshToken || typeof refreshToken !== "string") {
                logger.warn("Logout failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "LOGOUT_FAILED",
                    status: "FAILED",
                    metadata: {
                        reason: "REFRESH_TOKEN_REQUIRED"
                    }
                }));
                res.status(401).json({ message: "Refresh token is required" });
                return;
            }

            await revokeRefreshTokenSession(refreshToken.trim());
            logger.info("Logout success", buildAuthMeta(req, {
                category: "AUTH",
                action: "LOGOUT_SUCCESS",
                status: "SUCCESS"
            }));
            res.status(200).json({ message: "Logged out successfully" });
        } catch (error: unknown) {
            if (error instanceof Error && /refresh token|session/i.test(error.message)) {
                logger.warn("Logout failed", buildAuthMeta(req, {
                    category: "AUTH",
                    action: "LOGOUT_FAILED",
                    status: "FAILED",
                    metadata: {
                        reason: "INVALID_REFRESH_TOKEN"
                    }
                }));
                res.status(401).json({ message: "Invalid or expired refresh token" });
                return;
            }

            logger.error("Logout failed", error, buildAuthMeta(req, {
                category: "AUTH",
                action: "LOGOUT_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "UNEXPECTED_ERROR"
                }
            }));
            console.error("Error logging out session:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async me(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.userId) {
                res.status(401).json({ message: "Unauthenticated" });
                return;
            }

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOne({
                where: { id: auth.userId },
                relations: ["tenant", "role"]
            });

            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json({ user: sanitizeUser(user) });
        } catch (error) {
            console.error("Error fetching current user:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
