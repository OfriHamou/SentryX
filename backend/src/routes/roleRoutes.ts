import { Router } from "express";
import { RoleController } from "../controllers/RoleController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", isLoggedIn, hasAccess("roles", "read"), RoleController.getAllRoles);
router.get("/:id", isLoggedIn, hasAccess("roles", "read"), RoleController.getRoleById);

export default router;
