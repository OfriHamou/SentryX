import { In } from "typeorm";
import { AppDataSource } from "../db";
import { Role } from "../models/Role";

const ROLE_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
    expiresAt: number;
    value: T;
}

let allRolesCache: CacheEntry<Role[]> | null = null;
const roleByIdCache = new Map<number, CacheEntry<Role | null>>();
const roleByNameCache = new Map<string, CacheEntry<Role | null>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
    return Boolean(entry && entry.expiresAt > Date.now());
}

function expiresAt(): number {
    return Date.now() + ROLE_CACHE_TTL_MS;
}

function primeRoleByIdCache(roles: Role[]) {
    const expiry = expiresAt();

    for (const role of roles) {
        roleByIdCache.set(role.id, {
            value: role,
            expiresAt: expiry,
        });
        roleByNameCache.set(role.roleName, {
            value: role,
            expiresAt: expiry,
        });
    }
}

export class RoleCacheService {
    static async getRoleById(roleId: number): Promise<Role | null> {
        const cachedRole = roleByIdCache.get(roleId);
        if (isFresh(cachedRole)) {
            return cachedRole.value;
        }

        const roleRepo = AppDataSource.getRepository(Role);
        const role = await roleRepo.findOneBy({ id: roleId });

        roleByIdCache.set(roleId, {
            value: role,
            expiresAt: expiresAt(),
        });

        if (role) {
            roleByNameCache.set(role.roleName, {
                value: role,
                expiresAt: expiresAt(),
            });
        }

        return role;
    }

    static async getRolesByNames(roleNames: string[]): Promise<Role[]> {
        const normalizedRoleNames = roleNames
            .map(roleName => roleName.trim())
            .filter(Boolean);

        if (normalizedRoleNames.length === 0) {
            return [];
        }

        if (isFresh(allRolesCache)) {
            return allRolesCache.value.filter(role => normalizedRoleNames.includes(role.roleName));
        }

        const cachedRoles: Role[] = [];
        const missingRoleNames: string[] = [];

        for (const roleName of normalizedRoleNames) {
            const cachedRole = roleByNameCache.get(roleName);
            if (!isFresh(cachedRole)) {
                missingRoleNames.push(roleName);
                continue;
            }

            if (cachedRole.value) {
                cachedRoles.push(cachedRole.value);
            }
        }

        if (missingRoleNames.length === 0) {
            return cachedRoles.sort((left, right) => left.roleName.localeCompare(right.roleName));
        }

        const roleRepo = AppDataSource.getRepository(Role);
        const roles = await roleRepo.find({
            where: { roleName: In(missingRoleNames) },
            order: { roleName: "ASC" },
        });

        primeRoleByIdCache(roles);

        const foundRoleNames = new Set(roles.map(role => role.roleName));
        const expiry = expiresAt();
        for (const missingRoleName of missingRoleNames) {
            if (!foundRoleNames.has(missingRoleName)) {
                roleByNameCache.set(missingRoleName, {
                    value: null,
                    expiresAt: expiry,
                });
            }
        }

        return [...cachedRoles, ...roles].sort((left, right) => left.roleName.localeCompare(right.roleName));
    }

    static async getAllRoles(): Promise<Role[]> {
        if (isFresh(allRolesCache)) {
            return allRolesCache.value;
        }

        const roleRepo = AppDataSource.getRepository(Role);
        const roles = await roleRepo.find({
            order: { roleName: "ASC" },
        });

        allRolesCache = {
            value: roles,
            expiresAt: expiresAt(),
        };
        primeRoleByIdCache(roles);

        return roles;
    }

    static clearRoleCache(): void {
        allRolesCache = null;
        roleByIdCache.clear();
        roleByNameCache.clear();
    }
}
