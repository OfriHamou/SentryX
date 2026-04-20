import { Router } from "express";
import { LicenseController } from "../controllers/LicenseController";

const router = Router();

router.get("/", LicenseController.getAllLicenses);

export default router;

