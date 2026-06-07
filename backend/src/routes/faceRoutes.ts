import { Router } from "express";
import multer from "multer";
import { FaceController } from "../controllers/FaceController";
import { isLoggedIn } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", isLoggedIn, FaceController.listFaces);
router.get("/:id/images/:filename", FaceController.getImage); // unauthenticated (img-friendly)
router.get("/by-robot/:robotId", FaceController.getFacesForRobot);

router.post("/", isLoggedIn, upload.array("photos"), FaceController.addFace);
router.post("/:id/images", isLoggedIn, upload.array("photos"), FaceController.addImages);

router.put("/:id", isLoggedIn, FaceController.updateFace);

router.delete("/:id", isLoggedIn, FaceController.remove);
router.delete("/:id/images/:filename", isLoggedIn, FaceController.removeImage);

export default router;
