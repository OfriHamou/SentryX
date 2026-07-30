import { Router } from "express";
import { AdminAlertController } from "../controllers/AdminAlertController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", requireAuth, hasAccess("admin_alerts", "read"), AdminAlertController.list);
router.get("/:id", requireAuth, hasAccess("admin_alerts", "read"), AdminAlertController.getOne);
router.patch("/:id/status", requireAuth, hasAccess("admin_alerts", "write"), AdminAlertController.updateStatus);
router.get("/:id/image", requireAuth, hasAccess("admin_alerts", "read"), AdminAlertController.getImage);

export default router;
