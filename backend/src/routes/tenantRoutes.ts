import { Router } from "express";
import { TenantController } from "../controllers/TenantController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", isLoggedIn, hasAccess("tenants", "read"), TenantController.getAllTenants);
router.get("/:id", isLoggedIn, hasAccess("tenants", "read"), TenantController.getTenantById);
router.get("/:id/licenses", isLoggedIn, hasAccess("licenses", "read"), TenantController.getTenantLicenses);
router.get("/:id/robots", isLoggedIn, hasAccess("tenants", "read"), TenantController.getTenantRobots);

router.post("/", isLoggedIn, hasAccess("tenants", "write"), TenantController.createTenant);
router.put("/:id", isLoggedIn, hasAccess("tenants", "write"), TenantController.updateTenant);
router.delete("/:id", isLoggedIn, hasAccess("tenants", "write"), TenantController.deleteTenant);

router.post("/:id/licenses", isLoggedIn, hasAccess("licenses", "write"), TenantController.addTenantLicense);
router.delete("/:id/licenses/:licenseCode", isLoggedIn, hasAccess("licenses", "write"), TenantController.removeTenantLicense);

export default router;
