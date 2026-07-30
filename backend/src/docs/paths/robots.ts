import { jsonBody, publicOperation, ref, secured, tenantScopedDescription } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const bridgeJson = (description: string): OpenApiObject => ({
    description,
    content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
});
const bridgeFailure = {
    description: "The configured robot service could not be reached.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
};
const protectedBridgeGet = (operationId: string, summary: string): OpenApiObject => secured({
    operationId,
    summary,
    description: tenantScopedDescription,
    tags: ["Robots"],
    responses: {
        "200": bridgeJson("Response proxied from the robot service."),
        "502": bridgeFailure,
    },
});
const publicBridgeGet = (operationId: string, summary: string): OpenApiObject => publicOperation({
    operationId,
    summary,
    tags: ["Robots"],
    responses: {
        "200": bridgeJson("Response proxied from the robot service."),
        "502": bridgeFailure,
    },
});

export const robotPaths: OpenApiPaths = {
    "/api/robot/health": { get: publicBridgeGet("getRobotHealth", "Get robot-control health") },
    "/api/robot/battery": { get: publicBridgeGet("getRobotBattery", "Get robot battery state") },
    "/api/robot/move": {
        post: secured({
            operationId: "moveRobot",
            summary: "Move the robot",
            tags: ["Robots"],
            requestBody: jsonBody({
                type: "object",
                required: ["speed", "rotation"],
                properties: {
                    speed: { type: "number", example: 0.4 },
                    rotation: { type: "number", example: 0 },
                },
            }),
            responses: {
                "200": bridgeJson("Robot-control response."),
                "502": bridgeFailure,
            },
        }, { validation: true }),
    },
    "/api/robot/stop": {
        post: secured({
            operationId: "stopRobot",
            summary: "Stop the robot",
            tags: ["Robots"],
            responses: {
                "200": bridgeJson("Robot-control response."),
                "502": bridgeFailure,
            },
        }),
    },
    "/api/robot/video": {
        get: publicOperation({
            operationId: "getRobotVideo",
            summary: "Proxy the robot MJPEG video stream",
            tags: ["Robots"],
            responses: {
                "200": {
                    description: "MJPEG stream.",
                    content: {
                        "multipart/x-mixed-replace": { schema: { type: "string", format: "binary" } },
                    },
                },
                "502": bridgeFailure,
            },
        }),
    },
    "/api/robot/detection/health": { get: publicBridgeGet("getDetectionHealth", "Get detection-service health") },
    "/api/robot/detection/status": { get: publicBridgeGet("getDetectionStatus", "Get detection-service status") },
    "/api/robot/current": {
        get: secured({
            operationId: "getCurrentRobot",
            summary: "Get the tenant's current robot",
            description: tenantScopedDescription,
            tags: ["Robots"],
            responses: {
                "200": {
                    description: "Current robot.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["ok", "robot"],
                        properties: { ok: { type: "boolean" }, robot: ref("Robot") },
                    } } },
                },
            },
        }, { notFound: true }),
        put: secured({
            operationId: "updateCurrentRobot",
            summary: "Update the tenant's current robot",
            description: tenantScopedDescription,
            tags: ["Robots"],
            requestBody: jsonBody({
                type: "object",
                properties: {
                    name: { type: "string" },
                    location: { type: "string" },
                },
            }),
            responses: {
                "200": {
                    description: "Updated robot.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["ok", "robot"],
                        properties: { ok: { type: "boolean" }, robot: ref("Robot") },
                    } } },
                },
            },
        }, { notFound: true }),
    },
    "/api/robot/events": {
        get: protectedBridgeGet("listRobotBridgeEvents", "List detection-service events"),
    },
    "/api/robot/events/latest": {
        get: protectedBridgeGet("getLatestRobotBridgeEvent", "Get the latest detection-service Event"),
    },
    "/api/robot/events/image/{filename}": {
        get: {
            operationId: "getRobotBridgeEventImage",
            summary: "Get an Event image from the detection service",
            tags: ["Robots", "Events"],
            security: [],
            parameters: [{
                name: "filename",
                in: "path",
                required: true,
                schema: { type: "string" },
            }],
            responses: {
                "200": {
                    description: "JPEG image.",
                    content: { "image/jpeg": { schema: { type: "string", format: "binary" } } },
                },
                "404": { $ref: "#/components/responses/NotFound" },
                "502": bridgeFailure,
            },
        },
    },
};

