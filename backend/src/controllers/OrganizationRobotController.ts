import { Request, Response } from "express";
import { AppDataSource } from "../db";
import { Robot } from "../models/Robot";
import { Tenant } from "../models/Tenant";
import { Event } from "../models/Event";
import { Notification } from "../models/Notification";
import { logger } from "../utils/logger";
import { FindOptionsWhere, IsNull, Not } from "typeorm";

interface RobotInput {
    name: string;
    location: string | null;
}

const ALLOWED_BODY_FIELDS = new Set(["name", "location"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RobotState = "active" | "archived" | "all";

function parseRobotInput(body: unknown): { value?: RobotInput; error?: string } {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Request body must be a JSON object" };
    }

    const input = body as Record<string, unknown>;
    const unsupportedField = Object.keys(input).find((key) => !ALLOWED_BODY_FIELDS.has(key));
    if (unsupportedField) {
        return { error: `Field "${unsupportedField}" is not allowed` };
    }

    if (typeof input.name !== "string") {
        return { error: "Robot name is required" };
    }

    const name = input.name.trim();
    if (!name) {
        return { error: "Robot name is required" };
    }
    if (name.length > 25) {
        return { error: "Robot name must be 25 characters or fewer." };
    }

    if (input.location !== undefined && input.location !== null && typeof input.location !== "string") {
        return { error: "Location must be a string or null" };
    }

    const location = typeof input.location === "string" ? input.location.trim() : null;
    if (location && location.length > 35) {
        return { error: "Location must be 35 characters or fewer." };
    }

    return {
        value: {
            name,
            location: location || null,
        },
    };
}

function serializeRobot(robot: Robot) {
    return {
        id: robot.id,
        name: robot.name,
        location: robot.location ?? null,
        status: robot.status,
        lastConnection: robot.lastConnection ?? null,
        updatedAt: robot.updatedAt,
        archivedAt: robot.archivedAt ?? null,
    };
}

function logFailure(action: string, error: unknown, tenantId: string, robotId?: string): void {
    logger.error(`Organization Robot operation failed: ${action}`, error, {
        category: "ORGANIZATION_ROBOT",
        action,
        status: "FAILED",
        context: "OrganizationRobotController",
        tenantId,
        ...(robotId ? { robotId } : {}),
    });
}

export class OrganizationRobotController {
    static async list(req: Request, res: Response) {
        const { tenantId } = res.locals.auth;
        const requestedState = req.query.state ?? "active";

        if (
            typeof requestedState !== "string" ||
            !["active", "archived", "all"].includes(requestedState)
        ) {
            return res.status(400).json({ message: "state must be active, archived, or all" });
        }

        const state = requestedState as RobotState;
        const where: FindOptionsWhere<Robot> = {
            tenant: { id: tenantId },
            ...(state === "active" ? { archivedAt: IsNull() } : {}),
            ...(state === "archived" ? { archivedAt: Not(IsNull()) } : {}),
        };

        try {
            const robots = await AppDataSource.getRepository(Robot).find({
                where,
                order: { updatedAt: "DESC", name: "ASC" },
            });

            return res.json(robots.map(serializeRobot));
        } catch (error) {
            logFailure("LIST_ROBOTS_FAILED", error, tenantId);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    static async create(req: Request, res: Response) {
        const { tenantId } = res.locals.auth;
        const parsed = parseRobotInput(req.body);

        if (!parsed.value) {
            return res.status(400).json({ message: parsed.error });
        }

        try {
            const robotRepository = AppDataSource.getRepository(Robot);
            const robot = robotRepository.create({
                name: parsed.value.name,
                location: parsed.value.location as unknown as string,
                tenant: { id: tenantId } as Tenant,
                status: "Offline",
                lastConnection: null as unknown as Date,
                archivedAt: null,
            });

            const savedRobot = await robotRepository.save(robot);
            return res.status(201).json(serializeRobot(savedRobot));
        } catch (error) {
            logFailure("CREATE_ROBOT_FAILED", error, tenantId);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    static async update(req: Request, res: Response) {
        const { tenantId } = res.locals.auth;
        const { id } = req.params;

        if (!UUID_PATTERN.test(id)) {
            return res.status(404).json({ message: "Robot not found" });
        }

        try {
            const robotRepository = AppDataSource.getRepository(Robot);
            const robot = await robotRepository.findOne({
                where: {
                    id,
                    tenant: { id: tenantId },
                },
            });

            if (!robot) {
                return res.status(404).json({ message: "Robot not found" });
            }

            if (robot.archivedAt) {
                return res.status(409).json({ message: "Archived Robots must be restored before editing." });
            }

            const parsed = parseRobotInput(req.body);
            if (!parsed.value) {
                return res.status(400).json({ message: parsed.error });
            }

            robot.name = parsed.value.name;
            robot.location = parsed.value.location as unknown as string;

            const savedRobot = await robotRepository.save(robot);
            return res.json(serializeRobot(savedRobot));
        } catch (error) {
            logFailure("UPDATE_ROBOT_FAILED", error, tenantId, id);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    static async remove(req: Request, res: Response) {
        const { tenantId } = res.locals.auth;
        const { id } = req.params;

        if (!UUID_PATTERN.test(id)) {
            return res.status(404).json({ message: "Robot not found" });
        }

        try {
            const result = await AppDataSource.transaction(async (manager) => {
                const robotRepository = manager.getRepository(Robot);
                const robot = await robotRepository.findOne({
                    where: { id, tenant: { id: tenantId } },
                    lock: { mode: "pessimistic_write" },
                });

                if (!robot) {
                    return null;
                }

                if (robot.archivedAt) {
                    return {
                        action: "archived" as const,
                        message: "Robot has operational history and was moved to Archived.",
                        robot: serializeRobot(robot),
                    };
                }

                const hasEvents = await manager.getRepository(Event).exists({
                    where: { robot: { id: robot.id } },
                });
                const hasNotifications = hasEvents
                    ? false
                    : await manager.getRepository(Notification).exists({
                        where: { robot: { id: robot.id } },
                    });

                if (!hasEvents && !hasNotifications) {
                    await robotRepository.remove(robot);
                    return {
                        action: "deleted" as const,
                        message: "Robot deleted permanently.",
                    };
                }

                robot.archivedAt = new Date();
                robot.status = "Offline";
                const savedRobot = await robotRepository.save(robot);
                return {
                    action: "archived" as const,
                    message: "Robot has operational history and was moved to Archived.",
                    robot: serializeRobot(savedRobot),
                };
            });

            if (!result) {
                return res.status(404).json({ message: "Robot not found" });
            }

            return res.json(result);
        } catch (error) {
            logFailure("REMOVE_ROBOT_FAILED", error, tenantId, id);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    static async restore(req: Request, res: Response) {
        const { tenantId } = res.locals.auth;
        const { id } = req.params;

        if (!UUID_PATTERN.test(id)) {
            return res.status(404).json({ message: "Robot not found" });
        }

        try {
            const robotRepository = AppDataSource.getRepository(Robot);
            const robot = await robotRepository.findOne({
                where: { id, tenant: { id: tenantId } },
            });

            if (!robot) {
                return res.status(404).json({ message: "Robot not found" });
            }

            if (!robot.archivedAt) {
                return res.json(serializeRobot(robot));
            }

            robot.archivedAt = null;
            robot.status = "Offline";
            const savedRobot = await robotRepository.save(robot);
            return res.json(serializeRobot(savedRobot));
        } catch (error) {
            logFailure("RESTORE_ROBOT_FAILED", error, tenantId, id);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
}
