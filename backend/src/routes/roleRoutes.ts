import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", isLoggedIn, hasAccess("roles", "read"), RoleController.getAllRoles);
router.get("/:id", isLoggedIn, hasAccess("roles", "read"), RoleController.getRoleById);
router.post("/", isLoggedIn, hasAccess("roles", "write"), RoleController.createRole);
router.put("/:id", isLoggedIn, hasAccess("roles", "write"), RoleController.updateRole);

export default router;
