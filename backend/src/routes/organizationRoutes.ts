import { Router } from "express";
import multer from "multer";
import { OrganizationController } from "../controllers/OrganizationController";
import { SecurityShiftController } from "../controllers/SecurityShiftController";
import { VisitorController } from "../controllers/VisitorController";
import { OrganizationRobotController } from "../controllers/OrganizationRobotController";
import { requireAuth } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();
const visitorUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const uploadVisitorFace: import("express").RequestHandler = (req, res, next) => {
    visitorUpload.single("faceImage")(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError) {
            res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Face image must be 5MB or smaller" : "Invalid face image upload" });
            return;
        }

        if (error) {
            res.status(400).json({ message: "Invalid face image upload" });
            return;
        }

        next();
    });
};

router.get("/me", requireAuth, hasAccess("organization_portal", "read"), OrganizationController.getMyOrganization);

router.get("/summary", requireAuth, hasAccess("organization_portal", "read"), OrganizationController.getOrganizationSummary);

router.get("/users", requireAuth, hasAccess("organization_users", "read"), OrganizationController.getOrganizationUsers);

router.post("/users", requireAuth, hasAccess("organization_users", "write"), OrganizationController.createOrganizationUser);

router.put("/users/:id", requireAuth, hasAccess("organization_users", "write"), OrganizationController.updateOrganizationUser);

router.get("/roles", requireAuth, hasAccess("organization_users", "read"), OrganizationController.getOrganizationRoles);

router.get("/robots", requireAuth, hasAccess("organization_robots", "read"), OrganizationRobotController.list);

router.post("/robots", requireAuth, hasAccess("organization_robots", "write"), OrganizationRobotController.create);

router.put("/robots/:id", requireAuth, hasAccess("organization_robots", "write"), OrganizationRobotController.update);

router.delete("/robots/:id", requireAuth, hasAccess("organization_robots", "write"), OrganizationRobotController.remove);

router.patch("/robots/:id/restore", requireAuth, hasAccess("organization_robots", "write"), OrganizationRobotController.restore);

router.get("/security-shifts", requireAuth, hasAccess("organization_security_shifts", "read"), SecurityShiftController.list);

router.get("/security-shifts/current", requireAuth, hasAccess("organization_security_shifts", "read"), SecurityShiftController.current);

router.get("/security-shifts/operators", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.operators);

router.post("/security-shifts", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.create);

router.put("/security-shifts/:id", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.update);

router.delete("/security-shifts/:id", requireAuth, hasAccess("organization_security_shifts", "write"), SecurityShiftController.cancel);

router.get("/visitors", requireAuth, hasAccess("organization_visitors", "read"), VisitorController.list);

router.get("/visitors/hosts", requireAuth, hasAccess("organization_visitors", "read"), VisitorController.hosts);

router.get("/visitors/:id/image", VisitorController.image);

router.get("/visitors/:id", requireAuth, hasAccess("organization_visitors", "read"), VisitorController.details);

router.post("/visitors", requireAuth, hasAccess("organization_visitors", "write"), uploadVisitorFace, VisitorController.create);

router.put("/visitors/:id", requireAuth, hasAccess("organization_visitors", "write"), uploadVisitorFace, VisitorController.update);

router.delete("/visitors/:id", requireAuth, hasAccess("organization_visitors", "write"), VisitorController.cancel);

export default router;
