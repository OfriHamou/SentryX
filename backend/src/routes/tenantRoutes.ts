import { Router } from "express";
import { TenantController } from "../controllers/TenantController";

const router = Router();

router.get("/", TenantController.getAllTenants);
router.get("/:id", TenantController.getTenantById);
router.get("/:id/licenses", TenantController.getTenantLicenses);
router.get("/:id/robots", TenantController.getTenantRobots);

router.post("/", TenantController.createTenant);
router.put("/:id", TenantController.updateTenant);
router.delete("/:id", TenantController.deleteTenant);

router.post("/:id/licenses", TenantController.addTenantLicense);
router.delete("/:id/licenses/:licenseCode", TenantController.removeTenantLicense);

export default router;
