import { Router } from "express";
import { OnCallController } from "../controllers/OnCallController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/me", requireAuth, hasAccess("on_call", "read"), OnCallController.me);
router.get("/tasks", requireAuth, hasAccess("on_call", "read"), OnCallController.tasks);

export default router;
