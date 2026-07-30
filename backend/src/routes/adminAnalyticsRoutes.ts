import { Router } from "express";
import { AdminAnalyticsController } from "../controllers/AdminAnalyticsController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.get("/", requireAuth, hasAccess("admin_analytics", "read"), AdminAnalyticsController.get);

export default router;
