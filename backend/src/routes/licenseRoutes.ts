import { Router } from "express";
import { LicenseController } from "../controllers/LicenseController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", isLoggedIn, hasAccess("licenses", "read"), LicenseController.getAllLicenses);
router.post("/", isLoggedIn, hasAccess("licenses", "write"), LicenseController.createLicense);
router.delete("/:code", isLoggedIn, hasAccess("licenses", "write"), LicenseController.deleteLicense);

export default router;

