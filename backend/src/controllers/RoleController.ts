import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Role } from "../models/Role";

type AllowedPagesPayload = string[];

interface RoleWritePayload {
    roleName?: unknown;
    allowedPages?: unknown;
}

function validateRoleName(roleName: unknown): { value?: string; error?: string } {
    if (typeof roleName !== "string" || roleName.trim().length === 0) {
        return { error: "roleName is required and must be non-empty" };
    }

    return { value: roleName.trim() };
}

function validateAllowedPagesPayload(allowedPages: unknown): { value?: AllowedPagesPayload; error?: string } {
    if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
        return { error: "allowedPages must be a non-empty array of page strings" };
    }

    const normalized: AllowedPagesPayload = [];
    const seen = new Set<string>();

    for (const pageValue of allowedPages) {
        if (typeof pageValue !== "string") {
            return { error: "allowedPages can only contain strings" };
        }

        const page = pageValue.trim().toLowerCase();
        if (!page) {
            return { error: "allowedPages cannot contain empty page names" };
        }

        if (!seen.has(page)) {
            seen.add(page);
            normalized.push(page);
        }
    }

    return { value: normalized };
}

export class RoleController {
    static async getAllRoles(req: Request, res: Response) {
        try {
            const roleRepo = AppDataSource.getRepository(Role);
            const roles = await roleRepo.find();
            res.status(200).json(roles);
        } catch (error) {
            console.error("Error fetching roles:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async getRoleById(req: Request, res: Response): Promise<void> {
        try {
            const roleId = Number(req.params.id);
            const roleRepo = AppDataSource.getRepository(Role);

            const role = await roleRepo.findOne({ where: { id: roleId } });

            if (!role) {
                res.status(404).json({ message: "Role not found" });
                return;
            }

            res.status(200).json(role);
        } catch (error) {
            console.error("Error fetching role:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async createRole(req: Request, res: Response): Promise<void> {
        try {
            const { roleName, allowedPages } = req.body as RoleWritePayload;

            const roleNameValidation = validateRoleName(roleName);
            if (!roleNameValidation.value) {
                res.status(400).json({ message: roleNameValidation.error });
                return;
            }

            const allowedPagesValidation = validateAllowedPagesPayload(allowedPages);
            if (!allowedPagesValidation.value) {
                res.status(400).json({ message: allowedPagesValidation.error });
                return;
            }

            const roleRepo = AppDataSource.getRepository(Role);
            const duplicateRole = await roleRepo
                .createQueryBuilder("role")
                .where("LOWER(role.roleName) = LOWER(:roleName)", { roleName: roleNameValidation.value })
                .getOne();

            if (duplicateRole) {
                res.status(409).json({ message: "Role name already exists" });
                return;
            }

            const createdRole = roleRepo.create({
                roleName: roleNameValidation.value,
                allowedPages: allowedPagesValidation.value
            });

            const savedRole = await roleRepo.save(createdRole);
            res.status(201).json(savedRole);
        } catch (error) {
            console.error("Error creating role:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async updateRole(req: Request, res: Response): Promise<void> {
        try {
            const roleId = Number(req.params.id);
            if (!Number.isInteger(roleId) || roleId <= 0) {
                res.status(400).json({ message: "Role id must be a positive integer" });
                return;
            }

            const { roleName, allowedPages } = req.body as RoleWritePayload;

            const roleNameValidation = validateRoleName(roleName);
            if (!roleNameValidation.value) {
                res.status(400).json({ message: roleNameValidation.error });
                return;
            }

            const allowedPagesValidation = validateAllowedPagesPayload(allowedPages);
            if (!allowedPagesValidation.value) {
                res.status(400).json({ message: allowedPagesValidation.error });
                return;
            }

            const roleRepo = AppDataSource.getRepository(Role);
            const role = await roleRepo.findOne({ where: { id: roleId } });

            if (!role) {
                res.status(404).json({ message: "Role not found" });
                return;
            }

            const duplicateRole = await roleRepo
                .createQueryBuilder("role")
                .where("LOWER(role.roleName) = LOWER(:roleName)", { roleName: roleNameValidation.value })
                .andWhere("role.id != :roleId", { roleId })
                .getOne();

            if (duplicateRole) {
                res.status(409).json({ message: "Role name already exists" });
                return;
            }

            role.roleName = roleNameValidation.value;
            role.allowedPages = allowedPagesValidation.value;

            const updatedRole = await roleRepo.save(role);
            res.status(200).json(updatedRole);
        } catch (error) {
            console.error("Error updating role:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
