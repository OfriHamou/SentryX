import type { Request, Response } from "express";

jest.mock("../utils/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        flush: jest.fn(),
    },
}));

function createResponse() {
    const res = {
        locals: {},
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            this.body = payload;
            return this;
        },
        setHeader: jest.fn(),
    };

    return res as unknown as Response & { statusCode: number; body: unknown };
}

function createRequest(body: unknown = {}, params: Record<string, string> = {}) {
    return {
        body,
        params,
        headers: {},
        get: () => undefined,
        ip: "127.0.0.1",
    } as unknown as Request;
}

function createFetchResponse(status: number, data: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(data),
        headers: {
            get: jest.fn().mockReturnValue("application/json"),
        },
    } as unknown as globalThis.Response;
}

describe("RobotController", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.JETSON_BASE_URL = "http://jetson-web:5000";
        process.env.JETSON_VIDEO_URL = "http://jetson-video:5001";
        process.env.JETSON_DETECTION_URL = "http://jetson-detect:5002";
        process.env.JETSON_AVOIDANCE_URL = "http://jetson-avoid:5003";
        process.env.JETSON_REQUEST_TIMEOUT_MS = "100";
        process.env.DB_USER = "test";
        process.env.DB_PASSWORD = "test";
        process.env.DB_HOST = "localhost";
        process.env.DB_PORT = "5432";
        process.env.DB_NAME = "test";
        global.fetch = jest.fn();
    });

    afterEach(() => {
        delete process.env.JETSON_REQUEST_TIMEOUT_MS;
    });

    it("accepts joystick movement when upstream manual control succeeds", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce(createFetchResponse(200, { ok: true }));
        const { RobotController } = await import("./RobotController");

        const req = createRequest({ speed: 0.4, rotation: 0.1 });
        const res = createResponse();

        await RobotController.move(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledWith(
            "http://jetson-web:5000/api/move",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ speed: 0.4, rotation: 0.1 }),
            })
        );
    });

    it("rejects joystick movement when auto mode owns the motors", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            createFetchResponse(409, { ok: false, error: "Auto mode currently owns motor control", mode: "auto" })
        );
        const { RobotController } = await import("./RobotController");

        const req = createRequest({ speed: 0.2, rotation: 0.0 });
        const res = createResponse();

        await RobotController.move(req, res);

        expect(res.statusCode).toBe(409);
        expect(res.body).toEqual({
            ok: false,
            error: "Auto mode currently owns motor control",
            mode: "auto",
        });
    });

    it("stops the robot and pauses avoidance for emergency stop", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, result: true }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, state: "PAUSED" }));
        const { RobotController } = await import("./RobotController");

        const req = createRequest();
        const res = createResponse();

        await RobotController.stop(req, res);

        expect(res.statusCode).toBe(200);
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            "http://jetson-web:5000/api/stop",
            expect.objectContaining({ method: "POST" })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            "http://jetson-avoid:5003/pause",
            expect.objectContaining({ method: "POST" })
        );
    });

    it("switches to auto mode by stopping first, changing mode, and starting avoidance", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, result: true }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, mode: "auto" }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, enabled: true, state: "FORWARD" }));
        const { RobotController } = await import("./RobotController");

        const req = createRequest({ mode: "auto" });
        const res = createResponse();

        await RobotController.setControlMode(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            ok: true,
            mode: "auto",
            avoidance: { ok: true, enabled: true, state: "FORWARD" },
        });
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            "http://jetson-web:5000/api/stop",
            expect.objectContaining({ method: "POST" })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            "http://jetson-web:5000/api/control-mode",
            expect.objectContaining({ method: "POST", body: JSON.stringify({ mode: "auto" }) })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            3,
            "http://jetson-avoid:5003/start",
            expect.objectContaining({ method: "POST" })
        );
    });

    it("switches to manual mode by stopping avoidance, stopping motors, and restoring manual ownership", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, enabled: false, state: "IDLE" }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, result: true }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, mode: "manual" }));
        const { RobotController } = await import("./RobotController");

        const req = createRequest({ mode: "manual" });
        const res = createResponse();

        await RobotController.setControlMode(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            ok: true,
            mode: "manual",
            avoidance: { ok: true, enabled: false, state: "IDLE" },
        });
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            "http://jetson-avoid:5003/stop",
            expect.objectContaining({ method: "POST" })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            "http://jetson-web:5000/api/stop",
            expect.objectContaining({ method: "POST" })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            3,
            "http://jetson-web:5000/api/control-mode",
            expect.objectContaining({ method: "POST", body: JSON.stringify({ mode: "manual" }) })
        );
    });

    it("keeps the robot stopped when switching to auto mode fails", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, result: true }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, mode: "auto" }))
            .mockResolvedValueOnce(createFetchResponse(503, { ok: false, error: "Model unavailable" }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, result: true }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, enabled: false, state: "IDLE" }))
            .mockResolvedValueOnce(createFetchResponse(200, { ok: true, mode: "manual" }));
        const { RobotController } = await import("./RobotController");

        const req = createRequest({ mode: "auto" });
        const res = createResponse();

        await RobotController.setControlMode(req, res);

        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({
            ok: false,
            error: "Failed to start autonomous mode",
            mode: "manual",
            details: { ok: false, error: "Model unavailable" },
        });
        expect(global.fetch).toHaveBeenCalledTimes(6);
        expect(global.fetch).toHaveBeenNthCalledWith(
            4,
            "http://jetson-web:5000/api/stop",
            expect.objectContaining({ method: "POST" })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            5,
            "http://jetson-avoid:5003/stop",
            expect.objectContaining({ method: "POST" })
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            6,
            "http://jetson-web:5000/api/control-mode",
            expect.objectContaining({ method: "POST", body: JSON.stringify({ mode: "manual" }) })
        );
    });
});
