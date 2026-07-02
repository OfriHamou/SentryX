import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { License } from "../models/License";

export class LicenseController {
    static async getAllLicenses(req: Request, res: Response) {
        try {
            const licenseRepo = AppDataSource.getRepository(License);
            const licenses = await licenseRepo.find();
            res.status(200).json(licenses);
        } catch (error) {
            console.error("Error fetching licenses:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async createLicense(req: Request, res: Response): Promise<any> {
        try {
            const { code, description } = req.body;

            if (!code) {
                return res.status(400).json({ message: "License 'code' is required." });
            }

            const licenseRepo = AppDataSource.getRepository(License);

            const existingLicense = await licenseRepo.findOneBy({ code });
            if (existingLicense) {
                return res.status(409).json({ message: `License with code '${code}' already exists.` });
            }

            const newLicense = licenseRepo.create({
                code,
                description
            });

            await licenseRepo.save(newLicense);

            return res.status(201).json(newLicense);
        } catch (error) {
            console.error("Error creating license:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    static async deleteLicense(req: Request, res: Response): Promise<any> {
        try {
            const { code } = req.params;
            const licenseRepo = AppDataSource.getRepository(License);

            const license = await licenseRepo.findOneBy({ code });
            if (!license) {
                return res.status(404).json({ message: "License not found" });
            }

            // Because of { onDelete: "CASCADE" } in TenantLicense,
            // deleting this will automatically wipe the tenant_licenses mapping!
            await licenseRepo.remove(license);

            return res.status(200).json({ message: "License and associated mappings deleted successfully" });
        } catch (error) {
            console.error("Error deleting license:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
}