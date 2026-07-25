import fs from "fs";
import path from "path";
import { AppDataSource } from "../db";
import { AuthorizedFace } from "../models/AuthorizedFace";
import { Robot } from "../models/Robot";
import { Visitor, VisitorStatus } from "../models/Visitor";
import { logger } from "../utils/logger";

export const AUTHORIZED_FACES_DIR = process.env.AUTHORIZED_FACES_DIR || path.join(__dirname, "..", "..", "media", "authorized_faces");
export const VISITOR_FACES_DIR = process.env.VISITOR_FACES_DIR || path.join(__dirname, "..", "..", "media", "visitors");

const JETSON_DETECTION_URL = process.env.JETSON_DETECTION_URL;

export function slugifyFaceName(name: string): string {
    return name.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\.\.+/g, "").replace(/\s+/g, "-").slice(0, 50) || "face";
}

export function authorizedFaceFolderName(face: { name: string; id: string }): string {
    return `${slugifyFaceName(face.name)}-${face.id}`;
}

export function visitorFolderName(visitor: { name: string; id: string }): string {
    return `${slugifyFaceName(visitor.name)}-${visitor.id}`;
}

export function visitorFaceImagePath(visitor: { name: string; id: string; faceImage: string }): string {
    return path.join(VISITOR_FACES_DIR, visitorFolderName(visitor), path.basename(visitor.faceImage));
}

function resolveInsideDirectory(baseDir: string, candidatePath: string): string | null {
    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedCandidatePath = path.resolve(candidatePath);
    const relativePath = path.relative(resolvedBaseDir, resolvedCandidatePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return null;
    }

    return resolvedCandidatePath;
}

export class FaceSyncService {
    static notifyFacesChanged(tenantId?: string): void {
        if (!JETSON_DETECTION_URL) {
            return;
        }

        try {
            fetch(`${JETSON_DETECTION_URL}/faces-changed`, {
                method: "POST",
                headers: tenantId ? { "X-Tenant-Id": tenantId } : undefined,
            }).catch((error) => {
                logger.warn("Robot face sync notification failed", {
                    category: "ROBOT",
                    action: "FACE_SYNC_NOTIFY_FAILED",
                    status: "FAILED",
                    context: "FaceSyncService",
                    tenantId,
                    metadata: { errorMessage: error?.message || String(error) },
                });
            });
        } catch {
            // Notification is best-effort and must not break CRUD operations.
        }
    }

    static async getFacesForRobot(robotId: string) {
        const robot = await AppDataSource.getRepository(Robot).findOne({
            where: { id: robotId },
            relations: ["tenant"],
        });

        if (!robot?.tenant) {
            return null;
        }

        const tenantId = robot.tenant.id;
        const now = new Date();

        const [permanentFaces, activeVisitors] = await Promise.all([
            AppDataSource.getRepository(AuthorizedFace)
                .createQueryBuilder("face")
                .where("face.tenant_id = :tenantId", { tenantId })
                .orderBy("face.added_at", "DESC")
                .getMany(),
            AppDataSource.getRepository(Visitor)
                .createQueryBuilder("visitor")
                .where("visitor.tenant_id = :tenantId", { tenantId })
                .andWhere("visitor.status = :status", { status: VisitorStatus.ACTIVE })
                .andWhere("visitor.start_at <= :now", { now })
                .andWhere("visitor.end_at > :now", { now })
                .orderBy("visitor.start_at", "ASC")
                .getMany(),
        ]);

        return [
            ...permanentFaces.map((face) => ({
                id: face.id,
                name: face.name,
                images: (face.images ?? []).map((filename) => `/api/faces/${face.id}/images/${encodeURIComponent(filename)}`),
            })),
            ...activeVisitors.map((visitor) => ({
                id: visitor.id,
                name: visitor.name,
                images: [`/api/faces/visitor-images/${visitor.id}`],
            })),
        ];
    }

    static getAuthorizedFaceImagePath(face: { name: string; id: string }, filename: string): string {
        return path.join(AUTHORIZED_FACES_DIR, authorizedFaceFolderName(face), path.basename(filename));
    }

    static getVisitorImagePath(visitor: Visitor): string | null {
        const imagePath = resolveInsideDirectory(VISITOR_FACES_DIR, visitorFaceImagePath(visitor));
        return imagePath && fs.existsSync(imagePath) ? imagePath : null;
    }
}
