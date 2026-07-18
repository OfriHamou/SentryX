import { Router } from "express";
import { RobotController } from "../controllers/RobotController";
import { isLoggedIn } from "../middleware/auth";  
import { hasAccess } from "../middleware/permission";

const router = Router();

// Robot bridge
router.get("/health",  RobotController.getHealth);
router.get("/battery", RobotController.getBattery);
router.post("/move", isLoggedIn, hasAccess("control", "write"), RobotController.move);
router.post("/stop", isLoggedIn, hasAccess("control", "write"), RobotController.stop);
router.get("/control-mode", isLoggedIn, hasAccess("control", "read"), RobotController.getControlMode);
router.post("/control-mode", isLoggedIn, hasAccess("control", "write"), RobotController.setControlMode);
router.get("/avoidance/health", isLoggedIn, hasAccess("control", "read"), RobotController.getAvoidanceHealth);
router.get("/avoidance/status", isLoggedIn, hasAccess("control", "read"), RobotController.getAvoidanceStatus);
router.post("/avoidance/start", isLoggedIn, hasAccess("control", "write"), RobotController.startAvoidance);
router.post("/avoidance/stop", isLoggedIn, hasAccess("control", "write"), RobotController.stopAvoidance);
router.post("/avoidance/pause", isLoggedIn, hasAccess("control", "write"), RobotController.pauseAvoidance);
router.post("/avoidance/resume", isLoggedIn, hasAccess("control", "write"), RobotController.resumeAvoidance);

// Video stream
router.get("/video", RobotController.getVideoStream);

// Detection service
router.get("/detection/health", RobotController.getDetectionHealth);
router.get("/detection/status", RobotController.getDetectionStatus);
router.get("/current", isLoggedIn, hasAccess("robots", "read"), RobotController.getMyRobot);
router.put("/current", isLoggedIn, hasAccess("robots", "write"), RobotController.updateMyRobot);

// Detection events
router.get("/events", isLoggedIn, hasAccess("events", "read"), RobotController.getEvents);
router.get("/events/latest", isLoggedIn, hasAccess("events", "read"), RobotController.getLatestEvent);
router.get("/events/image/:filename", RobotController.getEventImage);

export default router;
