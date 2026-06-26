import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { RegistrationController } from "../controllers/RegistrationController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();

// Public auth routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/me", isLoggedIn, AuthController.me);

// SentryX admin registration approval routes.
router.get("/admin/registration-requests", isLoggedIn, hasAccess("registration_requests", "read"), RegistrationController.getRegistrationRequests);
router.post("/admin/registration-requests/:userId/approve", isLoggedIn, hasAccess("registration_requests", "write"), RegistrationController.approveRequest);
router.post("/admin/registration-requests/:userId/reject", isLoggedIn, hasAccess("registration_requests", "write"), RegistrationController.rejectRequest);

export default router;
