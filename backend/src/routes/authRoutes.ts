import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { isLoggedIn } from "../middleware/auth";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/me", isLoggedIn, AuthController.me);

export default router;
