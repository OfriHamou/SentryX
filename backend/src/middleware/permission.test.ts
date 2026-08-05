import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/Role";
import { RoleCacheService } from "../services/RoleCacheService";
import { logger } from "../utils/logger";
import { hasAccess } from "./permission";

jest.mock("../services/RoleCacheService", () => ({
    RoleCacheService: {
        getRoleById: jest.fn(),
    },
}));

jest.mock("../utils/logger", () => ({
    logger: {
        warn: jest.fn(),
    },
}));

const getRoleByIdMock = RoleCacheService.getRoleById as jest.MockedFunction<
    typeof RoleCacheService.getRoleById
>;
const warnMock = logger.warn as jest.MockedFunction<typeof logger.warn>;

interface MiddlewareDoubles {
    req: Request;
    res: Response;
    next: jest.MockedFunction<NextFunction>;
    status: jest.MockedFunction<(code: number) => Response>;
    json: jest.MockedFunction<(body: unknown) => Response>;
}

function createDoubles(auth: unknown = {
    userId: "user-123",
    tenantId: "tenant-456",
    roleId: 7,
    roleName: "Operator",
}, includeAuth = true): MiddlewareDoubles {
    const status = jest.fn<Response, [number]>();
    const json = jest.fn<Response, [unknown]>();
    const res = {
        locals: includeAuth ? { auth } : {},
        status,
        json,
    } as unknown as Response;
    status.mockReturnValue(res);
    json.mockReturnValue(res);

    const req = {
        headers: { "x-request-id": "request-123" },
        method: "GET",
        originalUrl: "/api/alerts",
    } as unknown as Request;

    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    return { req, res, next, status, json };
}

function roleWith(allowedPages: unknown): Role {
    return {
        id: 7,
        roleName: "Operator",
        allowedPages,
        users: [],
    };
}

async function invoke(
    allowedPages: unknown,
    resource = "alerts",
    action = "read",
): Promise<MiddlewareDoubles> {
    getRoleByIdMock.mockResolvedValue(roleWith(allowedPages));
    const doubles = createDoubles();

    await hasAccess(resource, action)(doubles.req, doubles.res, doubles.next);

    return doubles;
}

describe("hasAccess", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe("authentication", () => {
        it("returns 401 and does not call next when auth is missing", async () => {
            const doubles = createDoubles(undefined, false);

            await hasAccess("alerts", "read")(doubles.req, doubles.res, doubles.next);

            expect(doubles.status).toHaveBeenCalledWith(401);
            expect(doubles.json).toHaveBeenCalledWith({ message: "Unauthenticated" });
            expect(doubles.next).not.toHaveBeenCalled();
            expect(getRoleByIdMock).not.toHaveBeenCalled();
        });

        it.each([
            ["missing", { userId: "user-123", tenantId: "tenant-456" }],
            ["zero", { userId: "user-123", tenantId: "tenant-456", roleId: 0 }],
            ["non-numeric", { userId: "user-123", tenantId: "tenant-456", roleId: "7" }],
        ])("returns 401 when roleId is %s", async (_label, auth) => {
            const doubles = createDoubles(auth);

            await hasAccess("alerts", "read")(doubles.req, doubles.res, doubles.next);

            expect(doubles.status).toHaveBeenCalledWith(401);
            expect(doubles.next).not.toHaveBeenCalled();
            expect(getRoleByIdMock).not.toHaveBeenCalled();
        });
    });

    describe("role loading", () => {
        it("returns 403 and warns when the Role does not exist", async () => {
            getRoleByIdMock.mockResolvedValue(null);
            const doubles = createDoubles();

            await hasAccess("alerts", "read")(doubles.req, doubles.res, doubles.next);

            expect(doubles.status).toHaveBeenCalledWith(403);
            expect(doubles.json).toHaveBeenCalledWith({ message: "Forbidden" });
            expect(warnMock).toHaveBeenCalledWith("Forbidden access", expect.any(Object));
            expect(doubles.next).not.toHaveBeenCalled();
        });

        it("returns 500 and does not call next when RoleCacheService fails", async () => {
            const error = new Error("cache unavailable");
            getRoleByIdMock.mockRejectedValue(error);
            const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
            const doubles = createDoubles();

            await hasAccess("alerts", "read")(doubles.req, doubles.res, doubles.next);

            expect(consoleError).toHaveBeenCalledWith("Error during authorization check:", error);
            expect(doubles.status).toHaveBeenCalledWith(500);
            expect(doubles.json).toHaveBeenCalledWith({ message: "Internal server error" });
            expect(doubles.next).not.toHaveBeenCalled();
        });
    });

    describe("wildcard permissions", () => {
        it.each([
            ["legacy all", ["all"], "read"],
            ["legacy all write", ["all"], "write"],
            ["legacy star", ["*"], "write"],
            ["object all", { all: ["read"] }, "write"],
            ["object star", { "*": ["write"] }, "read"],
        ])("allows access for %s", async (_label, permissions, action) => {
            const { next } = await invoke(permissions, "alerts", action);

            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe("object permission representation", () => {
        it("allows alerts:read and denies alerts:write or another resource", async () => {
            const read = await invoke({ alerts: ["read"] }, "alerts", "read");
            const write = await invoke({ alerts: ["read"] }, "alerts", "write");
            const robots = await invoke({ alerts: ["read"] }, "robots", "read");

            expect(read.next).toHaveBeenCalledTimes(1);
            expect(write.status).toHaveBeenCalledWith(403);
            expect(robots.status).toHaveBeenCalledWith(403);
        });

        it.each(["read", "write"])("allows alerts:%s when both actions are present", async (action) => {
            const { next } = await invoke({ alerts: ["read", "write"] }, "alerts", action);

            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe("legacy array representation", () => {
        it("allows read access for a bare resource", async () => {
            const { next } = await invoke(["alerts"], "alerts", "read");

            expect(next).toHaveBeenCalledTimes(1);
        });

        it("does not automatically grant write access for a bare resource", async () => {
            const { status, next } = await invoke(["alerts"], "alerts", "write");

            expect(status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it.each(["alerts:write", "alerts.write", "alerts/write"])(
            "supports the legacy %s action format",
            async (permission) => {
                const { next } = await invoke([permission], "alerts", "write");

                expect(next).toHaveBeenCalledTimes(1);
            },
        );
    });

    describe("normalization", () => {
        it.each([
            ["leading /api/", { alerts: ["read"] }, "/api/alerts", "read"],
            ["leading and trailing slashes", { alerts: ["read"] }, "/alerts/", "read"],
            ["resource case", { alerts: ["read"] }, "ALERTS", "read"],
            ["action case", { alerts: ["read"] }, "alerts", "READ"],
            ["whitespace", { " alerts ": [" read "] }, " alerts ", " read "],
        ])("normalizes %s", async (_label, permissions, resource, action) => {
            const { next } = await invoke(permissions, resource, action);

            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe("denial and success behavior", () => {
        it("returns the generic Forbidden response, warns, and does not call next when denied", async () => {
            const { status, json, next } = await invoke({ alerts: ["read"] }, "robots", "read");

            expect(status).toHaveBeenCalledWith(403);
            expect(json).toHaveBeenCalledWith({ message: "Forbidden" });
            expect(warnMock).toHaveBeenCalledWith("Forbidden access", expect.any(Object));
            expect(next).not.toHaveBeenCalled();
        });

        it("does not use roleName as authorization", async () => {
            getRoleByIdMock.mockResolvedValue(roleWith({ alerts: [] }));
            const doubles = createDoubles({
                userId: "user-123",
                tenantId: "tenant-456",
                roleId: 7,
                roleName: "Admin",
            });

            await hasAccess("alerts", "read")(doubles.req, doubles.res, doubles.next);

            expect(doubles.status).toHaveBeenCalledWith(403);
            expect(doubles.next).not.toHaveBeenCalled();
        });

        it("calls next exactly once and sends no response when access is allowed", async () => {
            const { next, status, json } = await invoke({ alerts: ["read"] });

            expect(next).toHaveBeenCalledTimes(1);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        });
    });
});
