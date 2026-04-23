import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/me", requireAuth, AuthController.me);

export default router;
