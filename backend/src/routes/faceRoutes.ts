import { Router } from "express";
import multer from "multer";
import { FaceController } from "../controllers/FaceController";
import { isLoggedIn } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", isLoggedIn, FaceController.listFaces);
router.post("/", isLoggedIn, upload.array("photos"), FaceController.addFace);
router.delete("/:id", isLoggedIn, FaceController.remove);
router.get("/:id/images/:filename", FaceController.getImage); // unauthenticated (img-friendly)
router.put("/:id", isLoggedIn, FaceController.updateFace);
router.post("/:id/images", isLoggedIn, upload.array("photos"), FaceController.addImages);
router.delete("/:id/images/:filename", isLoggedIn, FaceController.removeImage);

export default router;
