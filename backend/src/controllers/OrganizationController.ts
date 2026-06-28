import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Tenant } from "../models/Tenant";
import { User, UserStatus } from "../models/User";
import { logger } from "../utils/logger";
import { Role } from "../models/Role";
import { hashPassword } from "../auth/services/password";
import { RoleCacheService } from "../services/RoleCacheService";

const TENANT_ASSIGNABLE_ROLE_NAMES = [
    "TENANT_ADMIN",
    "OPERATIONS_MANAGER",
    "SECURITY_OPERATOR",
    "VISITOR_MANAGER",
    "VIEWER",
];

function parseRoleId(roleId: unknown): number | null {
    const parsedRoleId = Number(roleId);
    return Number.isInteger(parsedRoleId) && parsedRoleId > 0 ? parsedRoleId : null;
}

async function findTenantAssignableRole(roleId: number): Promise<Role | null> {
    const roles = await RoleCacheService.getRolesByNames(TENANT_ASSIGNABLE_ROLE_NAMES);
    return roles.find(role => role.id === roleId) ?? null;
}

function hasPermission(allowedPages: Record<string, string[] | undefined> | null | undefined, resource: string, action: string): boolean {
    const resourceActions = allowedPages?.[resource];
    const allActions = allowedPages?.all;

    return Boolean(
        resourceActions?.includes(action) ||
        resourceActions?.includes("all") ||
        allActions?.includes(action) ||
        allActions?.includes("all")
    );
}

export class OrganizationController {
    static async getMyOrganization(req: Request, res: Response) {
        try {
            const { userId, tenantId } = res.locals.auth;

            const userRepository = AppDataSource.getRepository(User);

            const currentUser = await userRepository.findOne({
                where: { id: userId, tenant: { id: tenantId } },
                relations: ["tenant", "role"],
            });

            if (!currentUser) {
                return res.status(404).json({ message: "User not found" });
            }

            const { passwordHash, tenant, ...sanitizedUser } = currentUser;

            res.json({
                tenant: tenant ? {
                    id: tenant.id,
                    name: tenant.name,
                    createdAt: tenant.createdAt,
                } : null,
                currentUser: {
                    id: sanitizedUser.id,
                    email: sanitizedUser.email,
                    fullName: sanitizedUser.fullName,
                    status: sanitizedUser.status,
                    roleId: sanitizedUser.role.id,
                    roleName: sanitizedUser.role.roleName,
                    allowedPages: sanitizedUser.role.allowedPages,
                },
            });
        } catch (error) {
            logger.error("Error getting organization data", error, {
                category: "ORGANIZATION",
                action: "GET_MY_ORGANIZATION_FAILED",
                status: "FAILED",
                context: "OrganizationController"
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async getOrganizationSummary(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const userRepository = AppDataSource.getRepository(User);

            const users = await userRepository.find({
                where: { tenant: { id: tenantId } },
                relations: ["role"],
            });

            const usersCount = users.length;
            const customerAccessCount = users.filter(u => hasPermission(u.role.allowedPages, "customer_portal", "read")).length;
            const organizationAccessCount = users.filter(u => hasPermission(u.role.allowedPages, "organization_portal", "read")).length;

            res.json({
                usersCount,
                customerAccessCount,
                organizationAccessCount,
            });

        } catch (error) {
            logger.error("Error getting organization summary", error, {
                category: "ORGANIZATION",
                action: "GET_ORGANIZATION_SUMMARY_FAILED",
                status: "FAILED",
                context: "OrganizationController"
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async getOrganizationUsers(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const userRepository = AppDataSource.getRepository(User);

            const users = await userRepository.find({
                where: { tenant: { id: tenantId } },
                relations: ["role"],
                select: ["id", "fullName", "email", "status", "createdAt", "role"],
            });

            const sanitizedUsers = users.map(user => ({
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                status: user.status,
                createdAt: user.createdAt,
                roleId: user.role.id,
                roleName: user.role.roleName,
                allowedPages: user.role.allowedPages,
            }));

            res.json(sanitizedUsers);
        } catch (error) {
            logger.error("Error getting organization users", error, {
                category: "ORGANIZATION",
                action: "GET_ORGANIZATION_USERS_FAILED",
                status: "FAILED",
                context: "OrganizationController"
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async createOrganizationUser(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const { fullName, email, password, roleId } = req.body;

            if (!fullName || !email || !password || !roleId) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            const parsedRoleId = parseRoleId(roleId);
            if (!parsedRoleId) {
                return res.status(400).json({ message: "Invalid role ID" });
            }

            const userRepository = AppDataSource.getRepository(User);
            const tenantRepository = AppDataSource.getRepository(Tenant);

            const tenant = await tenantRepository.findOneBy({ id: tenantId });
            if (!tenant) {
                return res.status(404).json({ message: "Tenant not found" });
            }

            const role = await findTenantAssignableRole(parsedRoleId);
            if (!role) {
                return res.status(400).json({ message: "Invalid organization role ID" });
            }

            const existingUser = await userRepository.findOneBy({ email });
            if (existingUser) {
                return res.status(409).json({ message: "Email already in use" });
            }

            const passwordHash = await hashPassword(password);

            const newUser = userRepository.create({
                fullName,
                email,
                passwordHash,
                role,
                tenant,
                status: UserStatus.APPROVED,
            });

            await userRepository.save(newUser);

            const { passwordHash: _, ...sanitizedUser } = newUser;

            res.status(201).json(sanitizedUser);

        } catch (error) {
            logger.error("Error creating organization user", error, {
                category: "ORGANIZATION",
                action: "CREATE_ORGANIZATION_USER_FAILED",
                status: "FAILED",
                context: "OrganizationController"
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async updateOrganizationUser(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const { id } = req.params;
            const { fullName, roleId } = req.body;

            const userRepository = AppDataSource.getRepository(User);

            const user = await userRepository.findOne({ where: { id, tenant: { id: tenantId } } });

            if (!user) {
                return res.status(404).json({ message: "User not found in this organization" });
            }

            if (fullName) {
                user.fullName = fullName;
            }

            if (roleId) {
                const parsedRoleId = parseRoleId(roleId);
                if (!parsedRoleId) {
                    return res.status(400).json({ message: "Invalid role ID" });
                }

                const role = await findTenantAssignableRole(parsedRoleId);
                if (!role) {
                    return res.status(400).json({ message: "Invalid organization role ID" });
                }
                user.role = role;
            }

            await userRepository.save(user);

            const { passwordHash: _, ...sanitizedUser } = user;
            res.json(sanitizedUser);

        } catch (error) {
            logger.error("Error updating organization user", error, {
                category: "ORGANIZATION",
                action: "UPDATE_ORGANIZATION_USER_FAILED",
                status: "FAILED",
                context: "OrganizationController"
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async getOrganizationRoles(req: Request, res: Response) {
        try {
            const roles = await RoleCacheService.getRolesByNames(TENANT_ASSIGNABLE_ROLE_NAMES);

            res.json(roles.map(role => ({
                id: role.id,
                roleName: role.roleName,
                allowedPages: role.allowedPages,
            })));
        } catch (error) {
            logger.error("Error getting organization roles", error, {
                category: "ORGANIZATION",
                action: "GET_ORGANIZATION_ROLES_FAILED",
                status: "FAILED",
                context: "OrganizationController"
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
