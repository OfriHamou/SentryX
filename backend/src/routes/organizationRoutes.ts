import { Router } from "express";
import { OrganizationController } from "../controllers/OrganizationController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/me", requireAuth, hasAccess("organization_portal", "read"), OrganizationController.getMyOrganization);

router.get("/summary", requireAuth, hasAccess("organization_portal", "read"), OrganizationController.getOrganizationSummary);

router.get("/users", requireAuth, hasAccess("organization_users", "read"), OrganizationController.getOrganizationUsers);

router.post("/users", requireAuth, hasAccess("organization_users", "write"), OrganizationController.createOrganizationUser);

router.put("/users/:id", requireAuth, hasAccess("organization_users", "write"), OrganizationController.updateOrganizationUser);

router.get("/roles", requireAuth, hasAccess("organization_users", "read"), OrganizationController.getOrganizationRoles);

export default router;
