import { Router } from "express";
import { OrganizationController } from "../controllers/OrganizationController";
import { SecurityShiftController } from "../controllers/SecurityShiftController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/me", requireAuth, hasAccess("organization_portal", "read"), OrganizationController.getMyOrganization);

router.get("/summary", requireAuth, hasAccess("organization_portal", "read"), OrganizationController.getOrganizationSummary);

router.get("/users", requireAuth, hasAccess("organization_users", "read"), OrganizationController.getOrganizationUsers);

router.post("/users", requireAuth, hasAccess("organization_users", "write"), OrganizationController.createOrganizationUser);

router.put("/users/:id", requireAuth, hasAccess("organization_users", "write"), OrganizationController.updateOrganizationUser);

router.get("/roles", requireAuth, hasAccess("organization_users", "read"), OrganizationController.getOrganizationRoles);

router.get("/security-shifts", requireAuth, hasAccess("organization_security_shifts", "read"), SecurityShiftController.list);

router.get("/security-shifts/current", requireAuth, hasAccess("organization_security_shifts", "read"), SecurityShiftController.current);

router.get("/security-shifts/operators", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.operators);

router.post("/security-shifts", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.create);

router.put("/security-shifts/:id", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.update);

router.delete("/security-shifts/:id", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.cancel);

export default router;
