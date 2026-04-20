import { Router } from "express";
import { TenantController } from "../controllers/TenantController";

const router = Router();

router.get("/", TenantController.getAllTenants);
router.get("/:id", TenantController.getTenantById);
router.get("/:id/licenses", TenantController.getTenantLicenses);
router.get("/:id/robots", TenantController.getTenantRobots);

router.post("/", TenantController.createTenant);
router.delete("/:id", TenantController.deleteTenant);

export default router;
