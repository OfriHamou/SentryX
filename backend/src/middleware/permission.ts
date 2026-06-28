import { NextFunction, Request, Response } from "express";
import type { AuthIdentityPayload } from "../auth/types";
import { logger } from "../utils/logger";
import { RoleCacheService } from "../services/RoleCacheService";

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

type AllowedPagesShape = Record<string, unknown> | string[];

function normalizePermission(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/^\/api\//, "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");
}

function collectPermissionsFromRole(allowedPages: unknown): Set<string> {
    const normalized = new Set<string>();
    const allowedActions = new Set(["read", "write"]);

    const add = (permission: string) => {
        const normalizedPermission = normalizePermission(permission);
        if (normalizedPermission.length > 0) {
            normalized.add(normalizedPermission);
        }
    };

    if (!allowedPages) {
        return normalized;
    }

    if (Array.isArray(allowedPages)) {
        for (const entry of allowedPages) {
            if (typeof entry === "string") {
                const value = normalizePermission(entry);
                if (value === "all" || value === "*") {
                    add("all");
                } else {
                    add(value);
                    add(`${value}:read`);
                }
            }
        }
        return normalized;
    }

    if (typeof allowedPages !== "object") {
        return normalized;
    }

    for (const [resource, value] of Object.entries(allowedPages as AllowedPagesShape)) {
        const normalizedResource = normalizePermission(resource);
        if (!normalizedResource || !Array.isArray(value)) {
            continue;
        }

        if (normalizedResource === "all" || normalizedResource === "*") {
            if (value.some((action) => typeof action === "string" && allowedActions.has(normalizePermission(action)))) {
                add("all");
            }
            continue;
        }

        for (const action of value) {
            if (typeof action !== "string") {
                continue;
            }

            const normalizedAction = normalizePermission(action);
            if (allowedActions.has(normalizedAction)) {
                add(`${normalizedResource}:${normalizedAction}`);
            }
        }
    }

    return normalized;
}

function roleAllows(permissionSet: Set<string>, resource: string, action?: string): boolean {
    const normalizedResource = normalizePermission(resource);
    if (!normalizedResource) {
        return false;
    }

    const wildcardPermissions = new Set(["*", "all"]);
    for (const wildcard of wildcardPermissions) {
        if (permissionSet.has(wildcard)) {
            return true;
        }
    }

    const normalizedAction = action ? normalizePermission(action) : "";

    const candidates = new Set<string>([
        normalizedResource,
        `/${normalizedResource}`
    ]);

    if (normalizedAction) {
        candidates.add(`${normalizedResource}:${normalizedAction}`);
        candidates.add(`${normalizedResource}.${normalizedAction}`);
        candidates.add(`${normalizedResource}/${normalizedAction}`);
    }

    for (const candidate of candidates) {
        if (permissionSet.has(candidate)) {
            return true;
        }
    }

    for (const permission of permissionSet) {
        if (permission.endsWith("*")) {
            const prefix = permission.slice(0, -1);
            if (normalizedResource.startsWith(prefix)) {
                return true;
            }
        }
    }

    return false;
}

export function hasAccess(resource: string, action?: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const auth = res.locals.auth as AuthIdentityPayload | undefined;

        if (!auth?.roleId) {
            res.status(401).json({ message: "Unauthenticated" });
            return;
        }

        try {
            const role = await RoleCacheService.getRoleById(auth.roleId);

            if (!role) {
                logger.warn("Forbidden access", {
                    category: "SECURITY",
                    action: "FORBIDDEN_ROLE_NOT_FOUND",
                    status: "FAILED",
                    context: "PermissionMiddleware",
                    userId: auth.userId,
                    requestId: getRequestId(req),
                    metadata: {
                        roleId: auth.roleId,
                        method: req.method,
                        route: req.originalUrl,
                        resource,
                        action: action || "read",
                        reason: "ROLE_NOT_FOUND"
                    }
                });
                res.status(403).json({ message: "Forbidden" });
                return;
            }

            const permissionSet = collectPermissionsFromRole(role.allowedPages);
            const allowed = roleAllows(permissionSet, resource, action);

            if (!allowed) {
                logger.warn("Forbidden access", {
                    category: "SECURITY",
                    action: "FORBIDDEN_PERMISSION_DENIED",
                    status: "FAILED",
                    context: "PermissionMiddleware",
                    userId: auth.userId,
                    requestId: getRequestId(req),
                    metadata: {
                        roleId: auth.roleId,
                        method: req.method,
                        route: req.originalUrl,
                        resource,
                        action: action || "read",
                        reason: "PERMISSION_DENIED"
                    }
                });
                res.status(403).json({ message: "Forbidden" });
                return;
            }

            next();
        } catch (error) {
            console.error("Error during authorization check:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    };
}
