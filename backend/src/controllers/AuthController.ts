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
        createdAt: user.createdAt
    };
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
                res.status(409).json({ message: "Email is already registered" });
                return;
            }

            const tenant = await tenantRepo.findOneBy({ id: tenantId });
            if (!tenant) {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            const role = await roleRepo.findOneBy({ id: numericRoleId });
            if (!role) {
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
                res.status(500).json({ message: "Unable to load created user" });
                return;
            }

            res.status(201).json({ user: sanitizeUser(userWithRelations) });
        } catch (error: unknown) {
            if (error instanceof QueryFailedError) {
                const dbError = error as QueryFailedError & { driverError?: { code?: string } };
                if (dbError.driverError?.code === "23505") {
                    res.status(409).json({ message: "Email is already registered" });
                    return;
                }
            }

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
            const userRepo = AppDataSource.getRepository(User);

            const user = await userRepo.findOne({
                where: { email: normalizedEmail },
                relations: ["tenant", "role"]
            });

            if (!user) {
                res.status(401).json({ message: "Invalid credentials" });
                return;
            }

            const isPasswordValid = await verifyPassword(password, user.passwordHash);
            if (!isPasswordValid) {
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

            res.status(200).json({
                accessToken,
                refreshToken,
                user: sanitizeUser(user)
            });
        } catch (error) {
            console.error("Error logging in user:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async refresh(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body as RefreshRequestBody;

            if (!refreshToken || typeof refreshToken !== "string") {
                res.status(401).json({ message: "Refresh token is required" });
                return;
            }

            const { payload, user } = await validateRefreshTokenSession(refreshToken.trim());
            const accessToken = signAccessToken(payload);

            res.status(200).json({
                accessToken,
                refreshToken: refreshToken.trim(),
                user: sanitizeUser(user)
            });
        } catch (error: unknown) {
            if (error instanceof Error && /refresh token|session/i.test(error.message)) {
                res.status(401).json({ message: "Invalid or expired refresh token" });
                return;
            }

            console.error("Error refreshing access token:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async logout(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body as RefreshRequestBody;

            if (!refreshToken || typeof refreshToken !== "string") {
                res.status(401).json({ message: "Refresh token is required" });
                return;
            }

            await revokeRefreshTokenSession(refreshToken.trim());
            res.status(200).json({ message: "Logged out successfully" });
        } catch (error: unknown) {
            if (error instanceof Error && /refresh token|session/i.test(error.message)) {
                res.status(401).json({ message: "Invalid or expired refresh token" });
                return;
            }

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
