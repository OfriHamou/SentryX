import { Router } from "express";
import { RobotController } from "../controllers/RobotController";
import { isLoggedIn } from "../middleware/auth";  

const router = Router();

// Robot bridge
router.get("/health",  RobotController.getHealth);
router.get("/battery", RobotController.getBattery);
router.post("/move",   RobotController.move);
router.post("/stop",   RobotController.stop);

// Video stream
router.get("/video", RobotController.getVideoStream);

// Detection service
router.get("/detection/health", RobotController.getDetectionHealth);
router.get("/detection/status", RobotController.getDetectionStatus);
router.get("/current", isLoggedIn, RobotController.getMyRobot); 
router.put("/current", isLoggedIn, RobotController.updateMyRobot);

// Detection events
router.get("/events",                 RobotController.getEvents);
router.get("/events/latest",          RobotController.getLatestEvent);
router.get("/events/image/:filename", RobotController.getEventImage);

export default router;