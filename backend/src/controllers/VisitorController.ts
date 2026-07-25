import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../db";
import { Tenant } from "../models/Tenant";
import { User, UserStatus } from "../models/User";
import { Visitor, VisitorStatus } from "../models/Visitor";
import { FaceSyncService, VISITOR_FACES_DIR, slugifyFaceName, visitorFolderName } from "../services/FaceSyncService";
import { resolveVisitorStatus, syncVisitorDerivedStatus } from "../services/VisitorStatusService";
import { logger } from "../utils/logger";

interface VisitorPayload {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    purpose?: unknown;
    startAt?: unknown;
    endAt?: unknown;
    hostUserId?: unknown;
}

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseDate(value: unknown): Date | null {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalEmail(value: unknown): { value?: string | null; error?: string } {
    if (value === undefined || value === null || value === "") {
        return { value: null };
    }

    if (typeof value !== "string") {
        return { error: "email must be a string" };
    }

    const email = value.trim();
    if (!email) {
        return { value: null };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        return { error: "email must be valid" };
    }

    return { value: email };
}

function getImageExtension(file: Express.Multer.File): string | null {
    if (file.mimetype === "image/jpeg") {
        return ".jpg";
    }

    if (file.mimetype === "image/png") {
        return ".png";
    }

    if (file.mimetype === "image/webp") {
        return ".webp";
    }

    return null;
}

function isIncludedInRobotSync(visitor: Pick<Visitor, "status" | "startAt" | "endAt">, now = new Date()): boolean {
    return visitor.status === VisitorStatus.ACTIVE && visitor.startAt <= now && visitor.endAt > now;
}

async function syncAndDetectActiveSetChange(visitor: Visitor): Promise<boolean> {
    const wasIncluded = isIncludedInRobotSync(visitor);
    const changed = await syncVisitorDerivedStatus(visitor);
    return changed && wasIncluded !== isIncludedInRobotSync(visitor);
}

async function validatePayload(payload: VisitorPayload, tenantId: string): Promise<{
    value?: {
        name: string;
        phone: string;
        email: string | null;
        purpose: string;
        startAt: Date;
        endAt: Date;
        host: User;
    };
    error?: string;
}> {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const purpose = typeof payload.purpose === "string" ? payload.purpose.trim() : "";
    const hostUserId = typeof payload.hostUserId === "string" ? payload.hostUserId.trim() : "";
    const startAt = parseDate(payload.startAt);
    const endAt = parseDate(payload.endAt);
    const emailResult = parseOptionalEmail(payload.email);

    if (emailResult.error) {
        return { error: emailResult.error };
    }

    if (!name || !phone || !purpose || !hostUserId || !startAt || !endAt) {
        return { error: "name, phone, purpose, hostUserId, startAt, and endAt are required" };
    }

    if (phone.length > 30) {
        return { error: "phone is too long" };
    }

    if (endAt <= startAt) {
        return { error: "endAt must be after startAt" };
    }

    if (endAt <= new Date()) {
        return { error: "Visit end time must be in the future" };
    }

    const host = await AppDataSource.getRepository(User).findOne({
        where: { id: hostUserId, tenant: { id: tenantId } },
        relations: ["tenant", "role"],
    });

    if (!host) {
        return { error: "Host was not found in this organization" };
    }

    if (host.status !== UserStatus.APPROVED) {
        return { error: "Host must be approved" };
    }

    return {
        value: {
            name,
            phone,
            email: emailResult.value ?? null,
            purpose,
            startAt,
            endAt,
            host,
        },
    };
}

function serializeVisitor(visitor: Visitor) {
    const host = visitor.host ? {
        id: visitor.host.id,
        fullName: visitor.host.fullName,
        email: visitor.host.email,
    } : null;

    return {
        id: visitor.id,
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        purpose: visitor.purpose,
        startAt: visitor.startAt,
        endAt: visitor.endAt,
        status: resolveVisitorStatus(visitor),
        host,
        faceImageUrl: `/api/organization/visitors/${visitor.id}/image`,
        createdAt: visitor.createdAt,
        updatedAt: visitor.updatedAt,
    };
}

function saveVisitorImage(visitor: Visitor, file: Express.Multer.File): string {
    const extension = getImageExtension(file);
    if (!extension) {
        throw new Error("UNSUPPORTED_IMAGE_TYPE");
    }

    const dir = path.join(VISITOR_FACES_DIR, visitorFolderName(visitor));
    fs.mkdirSync(dir, { recursive: true });
    const filename = `face${extension}`;
    fs.writeFileSync(path.join(dir, filename), file.buffer);
    return filename;
}

function renameVisitorFolderIfNeeded(visitor: Visitor, previousName: string): void {
    if (previousName === visitor.name) {
        return;
    }

    const oldDir = path.join(VISITOR_FACES_DIR, `${slugifyFaceName(previousName)}-${visitor.id}`);
    const newDir = path.join(VISITOR_FACES_DIR, visitorFolderName(visitor));
    if (oldDir !== newDir && fs.existsSync(oldDir)) {
        fs.renameSync(oldDir, newDir);
    }
}

async function findTenantVisitor(id: string, tenantId: string): Promise<Visitor | null> {
    return AppDataSource.getRepository(Visitor).findOne({
        where: { id, tenant: { id: tenantId } },
        relations: ["tenant", "host"],
    });
}

export class VisitorController {
    static async hosts(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const hosts = await AppDataSource.getRepository(User).find({
                where: {
                    tenant: { id: tenantId },
                    status: UserStatus.APPROVED,
                },
                order: { fullName: "ASC", email: "ASC" },
            });

            res.json(hosts.map(host => ({
                id: host.id,
                fullName: host.fullName,
                email: host.email,
            })));
        } catch (error) {
            logger.error("Error listing visitor hosts", error, {
                category: "ORGANIZATION",
                action: "LIST_VISITOR_HOSTS_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async list(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const view = typeof req.query.view === "string" ? req.query.view : "current";
            const statusFilter = view === "history"
                ? [VisitorStatus.EXPIRED, VisitorStatus.COMPLETED, VisitorStatus.CANCELLED]
                : [VisitorStatus.SCHEDULED, VisitorStatus.ACTIVE];
            const queryStatuses = view === "history"
                ? [...statusFilter, VisitorStatus.SCHEDULED, VisitorStatus.ACTIVE]
                : statusFilter;

            const visitors = await AppDataSource.getRepository(Visitor).find({
                where: { tenant: { id: tenantId }, status: In(queryStatuses) },
                relations: ["host"],
                order: { startAt: view === "history" ? "DESC" : "ASC" },
            });

            const activeSetChanges = await Promise.all(visitors.map(visitor => syncAndDetectActiveSetChange(visitor)));
            if (activeSetChanges.some(Boolean)) {
                FaceSyncService.notifyFacesChanged(tenantId);
            }
            res.json(visitors.map(serializeVisitor).filter(visitor => statusFilter.includes(visitor.status)));
        } catch (error) {
            logger.error("Error listing visitors", error, {
                category: "ORGANIZATION",
                action: "LIST_VISITORS_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async details(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const visitor = await findTenantVisitor(req.params.id, tenantId);
            if (!visitor) {
                return res.status(404).json({ message: "Visitor not found" });
            }

            if (await syncAndDetectActiveSetChange(visitor)) {
                FaceSyncService.notifyFacesChanged(tenantId);
            }
            res.json(serializeVisitor(visitor));
        } catch (error) {
            logger.error("Error getting visitor details", error, {
                category: "ORGANIZATION",
                action: "GET_VISITOR_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const { tenantId, userId } = res.locals.auth;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ message: "Face image is required" });
            }

            if (!allowedImageMimeTypes.has(file.mimetype)) {
                return res.status(400).json({ message: "Unsupported face image type" });
            }

            const validation = await validatePayload(req.body, tenantId);
            if (!validation.value) {
                return res.status(400).json({ message: validation.error });
            }

            const visitorRepository = AppDataSource.getRepository(Visitor);
            const visitor = visitorRepository.create({
                id: randomUUID(),
                tenant: { id: tenantId } as Tenant,
                host: validation.value.host,
                name: validation.value.name,
                phone: validation.value.phone,
                email: validation.value.email,
                purpose: validation.value.purpose,
                startAt: validation.value.startAt,
                endAt: validation.value.endAt,
                status: resolveVisitorStatus({ ...validation.value, status: VisitorStatus.SCHEDULED } as Visitor),
                faceImage: "face.jpg",
                createdBy: { id: userId } as User,
                updatedBy: { id: userId } as User,
            });

            visitor.faceImage = saveVisitorImage(visitor, file);
            const savedVisitor = await visitorRepository.save(visitor);
            const shouldNotify = isIncludedInRobotSync(savedVisitor);
            if (shouldNotify) {
                FaceSyncService.notifyFacesChanged(tenantId);
            }

            const hydratedVisitor = await visitorRepository.findOneOrFail({
                where: { id: savedVisitor.id },
                relations: ["host"],
            });
            res.status(201).json(serializeVisitor(hydratedVisitor));
        } catch (error) {
            if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") {
                return res.status(400).json({ message: "Unsupported face image type" });
            }

            logger.error("Error creating visitor", error, {
                category: "ORGANIZATION",
                action: "CREATE_VISITOR_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { tenantId, userId } = res.locals.auth;
            const visitorRepository = AppDataSource.getRepository(Visitor);
            const visitor = await findTenantVisitor(req.params.id, tenantId);

            if (!visitor) {
                return res.status(404).json({ message: "Visitor not found" });
            }

            if (visitor.status === VisitorStatus.CANCELLED) {
                return res.status(400).json({ message: "Cancelled visitors cannot be edited" });
            }

            const wasIncludedInRobotSync = isIncludedInRobotSync(visitor);
            const previousName = visitor.name;
            const validation = await validatePayload(req.body, tenantId);

            if (!validation.value) {
                return res.status(400).json({ message: validation.error });
            }

            const file = req.file;
            if (file && !allowedImageMimeTypes.has(file.mimetype)) {
                return res.status(400).json({ message: "Unsupported face image type" });
            }

            visitor.name = validation.value.name;
            visitor.phone = validation.value.phone;
            visitor.email = validation.value.email;
            visitor.purpose = validation.value.purpose;
            visitor.startAt = validation.value.startAt;
            visitor.endAt = validation.value.endAt;
            visitor.host = validation.value.host;
            visitor.status = resolveVisitorStatus(visitor);
            visitor.updatedBy = { id: userId } as User;

            renameVisitorFolderIfNeeded(visitor, previousName);
            if (file) {
                visitor.faceImage = saveVisitorImage(visitor, file);
            }

            const savedVisitor = await visitorRepository.save(visitor);
            const shouldNotify = wasIncludedInRobotSync !== isIncludedInRobotSync(savedVisitor) || (Boolean(file) && isIncludedInRobotSync(savedVisitor));
            if (shouldNotify) {
                FaceSyncService.notifyFacesChanged(tenantId);
            }

            res.json(serializeVisitor(savedVisitor));
        } catch (error) {
            if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") {
                return res.status(400).json({ message: "Unsupported face image type" });
            }

            logger.error("Error updating visitor", error, {
                category: "ORGANIZATION",
                action: "UPDATE_VISITOR_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async cancel(req: Request, res: Response) {
        try {
            const { tenantId, userId } = res.locals.auth;
            const visitorRepository = AppDataSource.getRepository(Visitor);
            const visitor = await findTenantVisitor(req.params.id, tenantId);

            if (!visitor) {
                return res.status(404).json({ message: "Visitor not found" });
            }

            const wasIncludedInRobotSync = isIncludedInRobotSync(visitor);
            visitor.status = VisitorStatus.CANCELLED;
            visitor.updatedBy = { id: userId } as User;
            const savedVisitor = await visitorRepository.save(visitor);

            if (wasIncludedInRobotSync) {
                FaceSyncService.notifyFacesChanged(tenantId);
            }

            res.json(serializeVisitor(savedVisitor));
        } catch (error) {
            logger.error("Error cancelling visitor", error, {
                category: "ORGANIZATION",
                action: "CANCEL_VISITOR_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async image(req: Request, res: Response) {
        try {
            const visitor = await AppDataSource.getRepository(Visitor).findOne({
                where: { id: req.params.id },
            });

            if (!visitor) {
                return res.status(404).json({ message: "Not found" });
            }

            const filePath = FaceSyncService.getVisitorImagePath(visitor);
            if (!filePath) {
                return res.status(404).json({ message: "Not found" });
            }

            res.sendFile(filePath);
        } catch (error) {
            logger.error("Error serving visitor image", error, {
                category: "ORGANIZATION",
                action: "GET_VISITOR_IMAGE_FAILED",
                status: "FAILED",
                context: "VisitorController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
