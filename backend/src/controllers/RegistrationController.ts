import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../db";
import { User, UserStatus } from "../models/User";
import type { AuthIdentityPayload, RejectionRequest } from "../auth/types";
import { EmailService } from "../services/EmailService";
import { logger } from "../utils/logger";

function sanitizeUser(user: User) {
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        jobTitle: user.jobTitle,
        status: user.status,
        createdAt: user.createdAt,
        approvedAt: user.approvedAt,
        approvedBy: user.approvedBy?.id,
        rejectedAt: user.rejectedAt,
        rejectedBy: user.rejectedBy?.id,
        rejectionReason: user.rejectionReason,
        tenantId: user.tenant?.id,
        tenantName: user.tenant?.name,
        tenantInviteCode: user.tenant?.inviteCode,
        roleId: user.role?.id,
        roleName: user.role?.roleName,
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
        context: "RegistrationController",
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

export class RegistrationController {
    /**
     * GET /api/auth/admin/registration-requests
     * Returns users that still need an admin decision or can be reconsidered.
     * Protected: requires authentication + read permission on registration requests
     */
    static async getRegistrationRequests(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.userId) {
                res.status(401).json({ message: "Unauthenticated" });
                return;
            }

            const userRepo = AppDataSource.getRepository(User);

            const actionableUsers = await userRepo.find({
                where: { status: In([UserStatus.PENDING_APPROVAL, UserStatus.REJECTED]) },
                relations: ["tenant", "role", "approvedBy", "rejectedBy"],
                order: { createdAt: "DESC" }
            });

            const sanitized = actionableUsers.map((user) => sanitizeUser(user));

            logger.info("Registration requests fetched", buildAuthMeta(req, {
                category: "REGISTRATION",
                action: "GET_PENDING_REQUESTS",
                status: "SUCCESS",
                metadata: {
                    count: actionableUsers.length
                }
            }, auth));

            res.status(200).json({ registrationRequests: sanitized });
        } catch (error) {
            logger.error("Failed to fetch registration requests", error, buildAuthMeta(req, {
                category: "REGISTRATION",
                action: "GET_PENDING_REQUESTS_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "UNEXPECTED_ERROR"
                }
            }));
            console.error("Error fetching registration requests:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    /**
     * POST /api/auth/admin/registration-requests/:userId/approve
     * Approves a pending registration request
     * Protected: requires authentication + write permission on registration requests
     */
    static async approveRequest(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.userId) {
                res.status(401).json({ message: "Unauthenticated" });
                return;
            }

            const { userId } = req.params;

            if (!userId) {
                res.status(400).json({ message: "User ID is required" });
                return;
            }

            const userRepo = AppDataSource.getRepository(User);

            const targetUser = await userRepo.findOne({
                where: { id: userId },
                relations: ["tenant", "role", "approvedBy"]
            });

            if (!targetUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            if (![UserStatus.PENDING_APPROVAL, UserStatus.REJECTED].includes(targetUser.status)) {
                logger.warn("Approval failed", buildAuthMeta(req, {
                    category: "REGISTRATION",
                    action: "APPROVE_FAILED",
                    status: "FAILED",
                    metadata: {
                        targetUserId: userId,
                        currentStatus: targetUser.status,
                        reason: "NOT_ACTIONABLE"
                    }
                }, auth));
                res.status(400).json({ message: `User cannot be approved from current status: ${targetUser.status}` });
                return;
            }

            const approverUser = await userRepo.findOneBy({ id: auth.userId });
            if (!approverUser) {
                res.status(401).json({ message: "Approver user not found" });
                return;
            }

            // Update user status
            targetUser.status = UserStatus.APPROVED;
            targetUser.approvedAt = new Date();
            targetUser.approvedBy = approverUser;
            targetUser.rejectedAt = null;
            targetUser.rejectedBy = null;
            targetUser.rejectionReason = null;

            const updatedUser = await userRepo.save(targetUser);

            // Reload with relations for response
            const reloadedUser = await userRepo.findOne({
                where: { id: updatedUser.id },
                relations: ["tenant", "role", "approvedBy"]
            });

            logger.info("Registration approved", buildAuthMeta(req, {
                category: "REGISTRATION",
                action: "REGISTRATION_APPROVED",
                status: "SUCCESS",
                metadata: {
                    targetUserId: userId,
                    targetUserEmail: updatedUser.email,
                    approverUserId: auth.userId
                }
            }, auth));

            await EmailService.sendRegistrationApproved({
                customerEmail: updatedUser.email,
                customerName: updatedUser.fullName,
                tenantName: reloadedUser?.tenant?.name
            });

            res.status(200).json({ user: sanitizeUser(reloadedUser!) });
        } catch (error) {
            logger.error("Failed to approve registration", error, buildAuthMeta(req, {
                category: "REGISTRATION",
                action: "APPROVE_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "UNEXPECTED_ERROR"
                }
            }));
            console.error("Error approving registration:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    /**
     * POST /api/auth/admin/registration-requests/:userId/reject
     * Rejects a pending registration request
     * Protected: requires authentication + write permission on registration requests
     */
    static async rejectRequest(req: Request, res: Response): Promise<void> {
        try {
            const auth = res.locals.auth as AuthIdentityPayload | undefined;

            if (!auth?.userId) {
                res.status(401).json({ message: "Unauthenticated" });
                return;
            }

            const { userId } = req.params;
            const { rejectionReason } = req.body as RejectionRequest;

            if (!userId) {
                res.status(400).json({ message: "User ID is required" });
                return;
            }

            const userRepo = AppDataSource.getRepository(User);

            const targetUser = await userRepo.findOne({
                where: { id: userId },
                relations: ["tenant", "role", "rejectedBy"]
            });

            if (!targetUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            if (targetUser.status !== UserStatus.PENDING_APPROVAL) {
                logger.warn("Rejection failed", buildAuthMeta(req, {
                    category: "REGISTRATION",
                    action: "REJECT_FAILED",
                    status: "FAILED",
                    metadata: {
                        targetUserId: userId,
                        currentStatus: targetUser.status,
                        reason: "NOT_PENDING"
                    }
                }, auth));
                res.status(400).json({ message: `User is not pending approval (current status: ${targetUser.status})` });
                return;
            }

            const rejectorUser = await userRepo.findOneBy({ id: auth.userId });
            if (!rejectorUser) {
                res.status(401).json({ message: "Rejector user not found" });
                return;
            }

            // Update user status
            targetUser.status = UserStatus.REJECTED;
            targetUser.rejectedAt = new Date();
            targetUser.rejectedBy = rejectorUser;
            targetUser.rejectionReason = rejectionReason || null;

            const updatedUser = await userRepo.save(targetUser);

            // Reload with relations for response
            const reloadedUser = await userRepo.findOne({
                where: { id: updatedUser.id },
                relations: ["tenant", "role", "rejectedBy"]
            });

            logger.info("Registration rejected", buildAuthMeta(req, {
                category: "REGISTRATION",
                action: "REGISTRATION_REJECTED",
                status: "SUCCESS",
                metadata: {
                    targetUserId: userId,
                    targetUserEmail: updatedUser.email,
                    rejectorUserId: auth.userId,
                    rejectionReason: rejectionReason || null
                }
            }, auth));

            await EmailService.sendRegistrationRejected({
                customerEmail: updatedUser.email,
                customerName: updatedUser.fullName,
                tenantName: reloadedUser?.tenant?.name,
                rejectionReason: updatedUser.rejectionReason
            });

            res.status(200).json({ user: sanitizeUser(reloadedUser!) });
        } catch (error) {
            logger.error("Failed to reject registration", error, buildAuthMeta(req, {
                category: "REGISTRATION",
                action: "REJECT_FAILED",
                status: "FAILED",
                metadata: {
                    reason: "UNEXPECTED_ERROR"
                }
            }));
            console.error("Error rejecting registration:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
