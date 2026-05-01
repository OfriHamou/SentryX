import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../db";
import { Role } from "../models/Role";
import type { AuthIdentityPayload } from "../auth/types";

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
            const roleRepo = AppDataSource.getRepository(Role);
            const role = await roleRepo.findOneBy({ id: auth.roleId });

            if (!role) {
                res.status(403).json({ message: "Forbidden" });
                return;
            }

            const permissionSet = collectPermissionsFromRole(role.allowedPages);
            const allowed = roleAllows(permissionSet, resource, action);

            if (!allowed) {
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
