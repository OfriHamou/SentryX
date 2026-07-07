import { Request, Response } from "express";
import { Not } from "typeorm";
import { AppDataSource } from "../db";
import { SecurityShift, SecurityShiftStatus } from "../models/SecurityShift";
import { Tenant } from "../models/Tenant";
import { User, UserStatus } from "../models/User";
import { logger } from "../utils/logger";

const SECURITY_OPERATOR_ROLE = "SECURITY_OPERATOR";

interface ShiftPayload {
    name?: unknown;
    startAt?: unknown;
    endAt?: unknown;
    assignedUserId?: unknown;
    notes?: unknown;
}

function parseDate(value: unknown): Date | null {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function resolveStatus(shift: SecurityShift, now = new Date()): SecurityShiftStatus {
    if (shift.status === SecurityShiftStatus.CANCELLED) {
        return SecurityShiftStatus.CANCELLED;
    }

    if (shift.startAt <= now && shift.endAt > now) {
        return SecurityShiftStatus.ACTIVE;
    }

    if (shift.endAt <= now) {
        return SecurityShiftStatus.COMPLETED;
    }

    return SecurityShiftStatus.SCHEDULED;
}

function serializeShift(shift: SecurityShift) {
    return {
        id: shift.id,
        name: shift.name,
        startAt: shift.startAt,
        endAt: shift.endAt,
        status: resolveStatus(shift),
        notes: shift.notes,
        assignedUser: shift.assignedUser ? {
            id: shift.assignedUser.id,
            fullName: shift.assignedUser.fullName,
            email: shift.assignedUser.email,
            roleName: shift.assignedUser.role?.roleName,
        } : null,
        createdAt: shift.createdAt,
        updatedAt: shift.updatedAt,
    };
}

async function syncDerivedStatus(shift: SecurityShift): Promise<void> {
    const resolvedStatus = resolveStatus(shift);
    if (shift.status !== SecurityShiftStatus.CANCELLED && shift.status !== resolvedStatus) {
        shift.status = resolvedStatus;
        await AppDataSource.getRepository(SecurityShift).save(shift);
    }
}

async function validatePayload(payload: ShiftPayload, tenantId: string): Promise<{ value?: { name: string; startAt: Date; endAt: Date; assignedUser: User; notes: string | null }; error?: string }> {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const assignedUserId = typeof payload.assignedUserId === "string" ? payload.assignedUserId.trim() : "";
    const startAt = parseDate(payload.startAt);
    const endAt = parseDate(payload.endAt);

    if (!name || !startAt || !endAt || !assignedUserId) {
        return { error: "name, startAt, endAt, and assignedUserId are required" };
    }

    if (endAt <= startAt) {
        return { error: "endAt must be after startAt" };
    }

    const assignedUser = await AppDataSource.getRepository(User).findOne({
        where: { id: assignedUserId, tenant: { id: tenantId } },
        relations: ["tenant", "role"],
    });

    if (!assignedUser) {
        return { error: "Assigned user was not found in this organization" };
    }

    if (assignedUser.status !== UserStatus.APPROVED) {
        return { error: "Assigned user must be approved" };
    }

    if (assignedUser.role?.roleName !== SECURITY_OPERATOR_ROLE) {
        return { error: "Assigned user must have the SECURITY_OPERATOR role" };
    }

    const notes = typeof payload.notes === "string" && payload.notes.trim().length > 0 ? payload.notes.trim() : null;

    return { value: { name, startAt, endAt, assignedUser, notes } };
}

async function hasOverlap(tenantId: string, startAt: Date, endAt: Date, excludeId?: string): Promise<boolean> {
    const query = AppDataSource.getRepository(SecurityShift)
        .createQueryBuilder("shift")
        .where("shift.tenant_id = :tenantId", { tenantId })
        .andWhere("shift.status != :cancelled", { cancelled: SecurityShiftStatus.CANCELLED })
        .andWhere("shift.start_at < :endAt", { endAt })
        .andWhere("shift.end_at > :startAt", { startAt });

    if (excludeId) {
        query.andWhere("shift.id != :excludeId", { excludeId });
    }

    return (await query.getCount()) > 0;
}

export class SecurityShiftController {
    static async operators(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const users = await AppDataSource.getRepository(User).find({
                where: {
                    tenant: { id: tenantId },
                    status: UserStatus.APPROVED,
                    role: { roleName: SECURITY_OPERATOR_ROLE },
                },
                relations: ["role"],
                order: { fullName: "ASC", email: "ASC" },
            });

            res.json(users.map(user => ({
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                status: user.status,
                roleName: user.role.roleName,
            })));
        } catch (error) {
            logger.error("Error listing security shift operators", error, {
                category: "ORGANIZATION",
                action: "LIST_SECURITY_SHIFT_OPERATORS_FAILED",
                status: "FAILED",
                context: "SecurityShiftController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async list(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const from = parseDate(req.query.from);
            const to = parseDate(req.query.to);

            if ((req.query.from && !from) || (req.query.to && !to)) {
                return res.status(400).json({ message: "Invalid date range" });
            }

            const query = AppDataSource.getRepository(SecurityShift)
                .createQueryBuilder("shift")
                .leftJoinAndSelect("shift.assignedUser", "assignedUser")
                .leftJoinAndSelect("assignedUser.role", "role")
                .where("shift.tenant_id = :tenantId", { tenantId })
                .orderBy("shift.start_at", "ASC");

            if (from) {
                query.andWhere("shift.end_at >= :from", { from });
            }

            if (to) {
                query.andWhere("shift.start_at <= :to", { to });
            }

            const shifts = await query.getMany();
            await Promise.all(shifts.map(syncDerivedStatus));
            res.json(shifts.map(serializeShift));
        } catch (error) {
            logger.error("Error listing security shifts", error, {
                category: "ORGANIZATION",
                action: "LIST_SECURITY_SHIFTS_FAILED",
                status: "FAILED",
                context: "SecurityShiftController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async current(req: Request, res: Response) {
        try {
            const { tenantId } = res.locals.auth;
            const now = new Date();

            const shift = await AppDataSource.getRepository(SecurityShift)
                .createQueryBuilder("shift")
                .leftJoinAndSelect("shift.assignedUser", "assignedUser")
                .leftJoinAndSelect("assignedUser.role", "role")
                .where("shift.tenant_id = :tenantId", { tenantId })
                .andWhere("shift.status != :cancelled", { cancelled: SecurityShiftStatus.CANCELLED })
                .andWhere("shift.start_at <= :now", { now })
                .andWhere("shift.end_at > :now", { now })
                .orderBy("shift.start_at", "DESC")
                .getOne();

            if (!shift) {
                return res.json(null);
            }

            await syncDerivedStatus(shift);
            res.json(serializeShift(shift));
        } catch (error) {
            logger.error("Error getting current security shift", error, {
                category: "ORGANIZATION",
                action: "GET_CURRENT_SECURITY_SHIFT_FAILED",
                status: "FAILED",
                context: "SecurityShiftController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async create(req: Request, res: Response) {
        try {
            const { tenantId, userId } = res.locals.auth;
            const validation = await validatePayload(req.body, tenantId);

            if (!validation.value) {
                return res.status(400).json({ message: validation.error });
            }

            const { name, startAt, endAt, assignedUser, notes } = validation.value;
            if (await hasOverlap(tenantId, startAt, endAt)) {
                return res.status(409).json({ message: "Security shift overlaps an existing non-cancelled shift" });
            }

            const shiftRepository = AppDataSource.getRepository(SecurityShift);
            const shift = shiftRepository.create({
                tenant: { id: tenantId } as Tenant,
                assignedUser,
                name,
                startAt,
                endAt,
                status: resolveStatus({ startAt, endAt, status: SecurityShiftStatus.SCHEDULED } as SecurityShift),
                notes,
                createdBy: { id: userId } as User,
                updatedBy: { id: userId } as User,
            });

            const savedShift = await shiftRepository.save(shift);
            const hydratedShift = await shiftRepository.findOneOrFail({
                where: { id: savedShift.id },
                relations: ["assignedUser", "assignedUser.role"],
            });

            res.status(201).json(serializeShift(hydratedShift));
        } catch (error) {
            logger.error("Error creating security shift", error, {
                category: "ORGANIZATION",
                action: "CREATE_SECURITY_SHIFT_FAILED",
                status: "FAILED",
                context: "SecurityShiftController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { tenantId, userId } = res.locals.auth;
            const shiftRepository = AppDataSource.getRepository(SecurityShift);
            const shift = await shiftRepository.findOne({
                where: { id: req.params.id, tenant: { id: tenantId }, status: Not(SecurityShiftStatus.CANCELLED) },
                relations: ["tenant", "assignedUser", "assignedUser.role"],
            });

            if (!shift) {
                return res.status(404).json({ message: "Security shift not found" });
            }

            const validation = await validatePayload(req.body, tenantId);
            if (!validation.value) {
                return res.status(400).json({ message: validation.error });
            }

            const { name, startAt, endAt, assignedUser, notes } = validation.value;
            if (await hasOverlap(tenantId, startAt, endAt, shift.id)) {
                return res.status(409).json({ message: "Security shift overlaps an existing non-cancelled shift" });
            }

            shift.name = name;
            shift.startAt = startAt;
            shift.endAt = endAt;
            shift.assignedUser = assignedUser;
            shift.notes = notes;
            shift.status = resolveStatus(shift);
            shift.updatedBy = { id: userId } as User;

            const savedShift = await shiftRepository.save(shift);
            res.json(serializeShift(savedShift));
        } catch (error) {
            logger.error("Error updating security shift", error, {
                category: "ORGANIZATION",
                action: "UPDATE_SECURITY_SHIFT_FAILED",
                status: "FAILED",
                context: "SecurityShiftController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }

    static async cancel(req: Request, res: Response) {
        try {
            const { tenantId, userId } = res.locals.auth;
            const shiftRepository = AppDataSource.getRepository(SecurityShift);
            const shift = await shiftRepository.findOne({
                where: { id: req.params.id, tenant: { id: tenantId } },
                relations: ["assignedUser", "assignedUser.role"],
            });

            if (!shift) {
                return res.status(404).json({ message: "Security shift not found" });
            }

            shift.status = SecurityShiftStatus.CANCELLED;
            shift.updatedBy = { id: userId } as User;
            const savedShift = await shiftRepository.save(shift);
            res.json(serializeShift(savedShift));
        } catch (error) {
            logger.error("Error cancelling security shift", error, {
                category: "ORGANIZATION",
                action: "CANCEL_SECURITY_SHIFT_FAILED",
                status: "FAILED",
                context: "SecurityShiftController",
            });
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
