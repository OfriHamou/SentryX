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
}

