import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Role } from "../models/Role";

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
}
