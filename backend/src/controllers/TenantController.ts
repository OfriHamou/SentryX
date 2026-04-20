import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Tenant } from "../models/Tenant";
import { TenantLicense } from "../models/TenantLicense";

export class TenantController {
    // Get all tenants with their connected licenses and robots
    static async getAllTenants(req: Request, res: Response) {
        try {
            const tenantRepo = AppDataSource.getRepository(Tenant);

            const tenants = await tenantRepo.find({
                relations: {
                    tenantLicenses: {
                        license: true // This joins: Tenant -> TenantLicense -> License
                    },
                    robots: true      // This joins: Tenant -> Robots
                }
            });

            res.status(200).json(tenants);
        } catch (error) {
            console.error("Error fetching tenants:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Get a single tenant by their ID
    static async getTenantById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const tenantRepo = AppDataSource.getRepository(Tenant);

            const tenant = await tenantRepo.findOne({
                where: { id: id },
                relations: ["robots", "users"]
            });

            if (!tenant) {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            res.status(200).json(tenant);
        } catch (error) {
            console.error("Error fetching tenant:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // 3. Get all licenses for a specific tenant
    static async getTenantLicenses(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const tenantRepo = AppDataSource.getRepository(Tenant);

            const tenant = await tenantRepo.findOne({
                where: { id: id },
                relations: {
                    tenantLicenses: {
                        license: true
                    }
                }
            });

            if (!tenant) {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            // Extract the actual license objects from the junction table
            const licenses = tenant.tenantLicenses.map(tl => ({
                ...tl.license,
                grantedAt: tl.grantedAt,
                expirationDate: tl.expirationDate
            }));

            res.status(200).json(licenses);
        } catch (error) {
            console.error("Error fetching tenant licenses:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Get all robots for a specific tenant
    static async getTenantRobots(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const tenantRepo = AppDataSource.getRepository(Tenant);

            const tenant = await tenantRepo.findOne({
                where: { id: id },
                relations: ["robots"]
            });

            if (!tenant) {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            res.status(200).json(tenant.robots);
        } catch (error) {
            console.error("Error fetching tenant robots:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Create a new tenant
    static async createTenant(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.body;

            if (!name) {
                res.status(400).json({ message: "Tenant name is required" });
                return;
            }

            const tenantRepo = AppDataSource.getRepository(Tenant);
            const newTenant = tenantRepo.create({ name });
            await tenantRepo.save(newTenant);

            res.status(201).json(newTenant);
        } catch (error) {
            console.error("Error creating tenant:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Update a tenant
    static async updateTenant(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name } = req.body;

            const tenantRepo = AppDataSource.getRepository(Tenant);
            const tenant = await tenantRepo.findOneBy({ id });

            if (!tenant) {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            if (name) {
                tenant.name = name;
            }

            await tenantRepo.save(tenant);
            res.status(200).json(tenant);
        } catch (error) {
            console.error("Error updating tenant:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Delete a tenant
    static async deleteTenant(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const tenantRepo = AppDataSource.getRepository(Tenant);

            const tenant = await tenantRepo.findOne({ where: { id } });

            if (!tenant) {
                res.status(404).json({ message: "Tenant not found" });
                return;
            }

            await tenantRepo.remove(tenant);

            res.status(200).json({ message: "Tenant deleted successfully" });
        } catch (error) {
            console.error("Error deleting tenant:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Add a license to a tenant
    static async addTenantLicense(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { licenseCode, expirationDate } = req.body;

            if (!licenseCode) {
                res.status(400).json({ message: "License code is required" });
                return;
            }

            const tenantLicenseRepo = AppDataSource.getRepository(TenantLicense);
            const exists = await tenantLicenseRepo.findOneBy({ tenantId: id, licenseCode });

            if (exists) {
                res.status(400).json({ message: "Tenant already has this license" });
                return;
            }

            const newLicense = tenantLicenseRepo.create({
                tenantId: id,
                licenseCode,
                expirationDate: expirationDate ? new Date(expirationDate) : undefined
            });

            await tenantLicenseRepo.save(newLicense);
            res.status(201).json(newLicense);
        } catch (error) {
            console.error("Error adding tenant license:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    // Remove a license from a tenant
    static async removeTenantLicense(req: Request, res: Response): Promise<void> {
        try {
            const { id, licenseCode } = req.params;
            const tenantLicenseRepo = AppDataSource.getRepository(TenantLicense);

            const license = await tenantLicenseRepo.findOneBy({ tenantId: id, licenseCode });
            if (!license) {
                res.status(404).json({ message: "Tenant license not found" });
                return;
            }

            await tenantLicenseRepo.remove(license);
            res.status(200).json({ message: "License removed successfully" });
        } catch (error) {
            console.error("Error removing tenant license:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
