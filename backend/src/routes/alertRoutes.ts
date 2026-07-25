import { Router } from "express";
import { AlertController } from "../controllers/AlertController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", requireAuth, hasAccess("alerts", "read"), AlertController.list);
router.get("/:id", requireAuth, hasAccess("alerts", "read"), AlertController.getOne);
router.patch("/:id/status", requireAuth, hasAccess("alerts", "write"), AlertController.updateStatus);

export default router;
