import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { AppDataSource } from "../db";
import { AuthorizedFace } from "../models/AuthorizedFace";
import { Robot } from "../models/Robot"; 
import { Tenant } from "../models/Tenant";
import type { AuthIdentityPayload } from "../auth/types";

const FACES_DIR = process.env.AUTHORIZED_FACES_DIR || path.join(__dirname, "..", "..", "media", "authorized_faces");
const JETSON_DETECTION_URL = process.env.JETSON_DETECTION_URL;

// fire-and-forget: tell the robot to re-sync now (the poll is the safety net if this fails)
function notifyRobotFacesChanged() {
    if (!JETSON_DETECTION_URL) return;
    try {
        fetch(`${JETSON_DETECTION_URL}/faces-changed`, { method: "POST" }).catch(() => {});
    } catch { /* notify must never break the actual operation */ }
}

function slugify(name: string): string {
    return name.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\.\.+/g, "").replace(/\s+/g, "-").slice(0, 50) || "face";
}
function folderName(face: { name: string; id: string }): string {
    return `${slugify(face.name)}-${face.id}`;
}

function getTenantId(res: Response): string | null {
    const auth = res.locals.auth as AuthIdentityPayload | undefined;
    if (!auth?.tenantId) { res.status(401).json({ ok: false, error: "Unauthenticated" }); return null; }
    return auth.tenantId;
}
async function resolveFace(req: Request, res: Response): Promise<AuthorizedFace | null> {
    const tenantId = getTenantId(res);
    if (!tenantId) return null;
    const face = await AppDataSource.getRepository(AuthorizedFace).findOne({
        where: { id: req.params.id, tenant: { id: tenantId } },
    });
    if (!face) { res.status(404).json({ ok: false, error: "Not found" }); return null; }
    return face;
}

export class FaceController {
    static async listFaces(req: Request, res: Response) {
        const tenantId = getTenantId(res);
        if (!tenantId) return;
        try {
            const faces = await AppDataSource.getRepository(AuthorizedFace).find({
                where: { tenant: { id: tenantId } },
                order: { addedAt: "DESC" },
            });
            return res.status(200).json({
                ok: true,
                faces: faces.map((face) => ({
                    id: face.id, name: face.name, role: face.role ?? null,
                    addedAt: face.addedAt, images: face.images ?? [],
                })),
            });
        } catch (error) {
            console.error("Error listing faces:", error);
            return res.status(500).json({ ok: false, error: "Failed to list faces" });
        }
    }

    static async addFace(req: Request, res: Response) {
        const tenantId = getTenantId(res);
        if (!tenantId) return;
        try {
            const { name, role } = req.body;
            if (!name || typeof name !== "string" || !name.trim()) {
                return res.status(400).json({ ok: false, error: "Name is required" });
            }
            const id = randomUUID();
            const files = (req.files as Express.Multer.File[]) ?? [];
            const imageFilenames: string[] = [];

            if (files.length > 0) {
                const dir = path.join(FACES_DIR, `${slugify(name)}-${id}`);
                fs.mkdirSync(dir, { recursive: true });
                files.forEach((file, index) => {
                    const ext = path.extname(file.originalname) || ".jpg";
                    const filename = `photo_${index + 1}${ext}`;
                    fs.writeFileSync(path.join(dir, filename), file.buffer);
                    imageFilenames.push(filename);
                });
            }

            const repo = AppDataSource.getRepository(AuthorizedFace);
            const face = repo.create({
                id,
                name: name.trim(),
                role: typeof role === "string" && role.trim() ? role.trim() : undefined,
                images: imageFilenames,
                tenant: { id: tenantId } as Tenant,
            });
            await repo.save(face);
            notifyRobotFacesChanged();
            return res.status(201).json({ ok: true, face: { id, name: face.name, role: face.role ?? null, images: imageFilenames } });
        } catch (e) {
            console.error("Error creating face:", e);
            return res.status(500).json({ ok: false, error: "Failed to create face" });
        }
    }

    static async remove(req: Request, res: Response) {
        const face = await resolveFace(req, res);
        if (!face) return;
        try {
            fs.rmSync(path.join(FACES_DIR, folderName(face)), { recursive: true, force: true });
            await AppDataSource.getRepository(AuthorizedFace).remove(face);
            notifyRobotFacesChanged();
            return res.status(200).json({ ok: true });
        } catch (e) {
            console.error("Error deleting face:", e);
            return res.status(500).json({ ok: false, error: "Failed to delete face" });
        }
    }

    static async updateFace(req: Request, res: Response) {
        const face = await resolveFace(req, res);
        if (!face) return;
        try {
            const { name, role } = req.body;
            if (typeof name === "string" && name.trim() && name.trim() !== face.name) {
                const oldDir = path.join(FACES_DIR, folderName(face));
                face.name = name.trim();
                const newDir = path.join(FACES_DIR, folderName(face));
                if (oldDir !== newDir && fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir);
            }
            if (typeof role === "string") face.role = role.trim();
            await AppDataSource.getRepository(AuthorizedFace).save(face);
            notifyRobotFacesChanged();
            return res.status(200).json({ ok: true, face: { id: face.id, name: face.name, role: face.role ?? null } });
        } catch (e) {
            console.error("Error updating face:", e);
            return res.status(500).json({ ok: false, error: "Failed to update face" });
        }
    }

    static async addImages(req: Request, res: Response) {
        const face = await resolveFace(req, res);
        if (!face) return;
        try {
            const files = (req.files as Express.Multer.File[]) ?? [];
            if (!files.length) return res.status(400).json({ ok: false, error: "No photos" });

            const dir = path.join(FACES_DIR, folderName(face));
            fs.mkdirSync(dir, { recursive: true });
            const added = files.map((file) => {
                const ext = path.extname(file.originalname) || ".jpg";
                const fn = `${randomUUID()}${ext}`;
                fs.writeFileSync(path.join(dir, fn), file.buffer);
                return fn;
            });
            face.images = [...(face.images ?? []), ...added];
            await AppDataSource.getRepository(AuthorizedFace).save(face);
            notifyRobotFacesChanged();
            return res.status(200).json({ ok: true, images: face.images });
        } catch (e) {
            console.error("Error adding images:", e);
            return res.status(500).json({ ok: false, error: "Failed to add images" });
        }
    }

    static async removeImage(req: Request, res: Response) {
        const face = await resolveFace(req, res);
        if (!face) return;
        try {
            const filename = path.basename(req.params.filename);
            const filePath = path.join(FACES_DIR, folderName(face), filename);
            if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
            face.images = (face.images ?? []).filter((f) => f !== filename);
            await AppDataSource.getRepository(AuthorizedFace).save(face);
            notifyRobotFacesChanged();
            return res.status(200).json({ ok: true, images: face.images });
        } catch (e) {
            console.error("Error removing image:", e);
            return res.status(500).json({ ok: false, error: "Failed to remove image" });
        }
    }

    // img-friendly (no auth header on <img>): looked up by id only
    static async getImage(req: Request, res: Response) {
        try {
            const face = await AppDataSource.getRepository(AuthorizedFace).findOne({ where: { id: req.params.id } });
            if (!face) return res.status(404).json({ ok: false, error: "Not found" });
            const filename = path.basename(req.params.filename);
            const filePath = path.join(FACES_DIR, folderName(face), filename);
            if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Image not found" });
            return res.sendFile(filePath);
        } catch (e) {
            console.error("Error serving face image:", e);
            return res.status(500).json({ ok: false, error: "Failed to serve image" });
        }
    }

    // GET /api/faces/by-robot/:robotId — robot-facing (no auth, like /report). Returns the robot's tenant's faces.
    static async getFacesForRobot(req: Request, res: Response) {
        try {
            const robot = await AppDataSource.getRepository(Robot).findOne({
                where: { id: req.params.robotId },
                relations: ["tenant"],
            });
            if (!robot?.tenant) return res.status(404).json({ ok: false, error: "Robot/tenant not found" });

            const faces = await AppDataSource.getRepository(AuthorizedFace).find({
                where: { tenant: { id: robot.tenant.id } },
                order: { addedAt: "DESC" },
            });
            return res.status(200).json({
                ok: true,
                faces: faces.map((f) => ({
                    id: f.id,
                    name: f.name,
                    images: (f.images ?? []).map((fn) => `/api/faces/${f.id}/images/${encodeURIComponent(fn)}`),
                })),
            });
        } catch (e) {
            console.error("Error fetching faces for robot:", e);
            return res.status(500).json({ ok: false, error: "Failed" });
        }
    }
}