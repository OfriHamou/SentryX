import { Router } from "express";
import multer from "multer";
import { FaceController } from "../controllers/FaceController";
import { isLoggedIn } from "../middleware/auth";
import { hasAccess } from "../middleware/permission";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", isLoggedIn, hasAccess("faces", "read"), FaceController.listFaces);
router.get("/:id/images/:filename", FaceController.getImage); // unauthenticated (img-friendly)
router.get("/by-robot/:robotId", isLoggedIn, hasAccess("faces", "read"), FaceController.getFacesForRobot);

router.post("/", isLoggedIn, hasAccess("faces", "write"), upload.array("photos"), FaceController.addFace);
router.post("/:id/images", isLoggedIn, hasAccess("faces", "write"), upload.array("photos"), FaceController.addImages);

router.put("/:id", isLoggedIn, hasAccess("faces", "write"), FaceController.updateFace);

router.delete("/:id", isLoggedIn, hasAccess("faces", "write"), FaceController.remove);
router.delete("/:id/images/:filename", isLoggedIn, hasAccess("faces", "write"), FaceController.removeImage);

export default router;
