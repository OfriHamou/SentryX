import { Router } from "express";
import { NotificationController } from "../controllers/NotificationController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

router.post("/", isLoggedIn, hasAccess("alerts", "write"), NotificationController.createNotification);
router.get("/", isLoggedIn, hasAccess("alerts", "read"), NotificationController.getNotifications);
router.get("/unread-count", isLoggedIn, hasAccess("alerts", "read"), NotificationController.getUnreadCount);
router.patch("/read-all", isLoggedIn, hasAccess("alerts", "read"), NotificationController.markAllRead);
router.patch("/:id/read", isLoggedIn, hasAccess("alerts", "read"), NotificationController.markRead);
router.patch("/:id/unread", isLoggedIn, hasAccess("alerts", "read"), NotificationController.markUnread);

export default router;
