import { idParameter, jsonBody, parameterRef, publicOperation, ref, secured, tenantScopedDescription } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const jsonResponse = (description: string, schema: OpenApiObject, example?: unknown): OpenApiObject => ({
    description,
    content: { "application/json": { schema, ...(example === undefined ? {} : { example }) } },
});
const imageResponse = {
    description: "Image bytes.",
    content: {
        "image/jpeg": { schema: { type: "string", format: "binary" } },
        "image/png": { schema: { type: "string", format: "binary" } },
        "image/webp": { schema: { type: "string", format: "binary" } },
    },
};
const alertExample = {
    id: "00000000-0000-4000-8000-000000000021",
    status: "OPEN",
    displayTitle: "Unknown person detected",
    startedAt: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
    assignedUser: null,
    assignedShift: null,
    resolvedBy: null,
    event: {
        id: "00000000-0000-4000-8000-000000000020",
        eventType: "face_detected_unknown",
        imagePath: "robot-01/frame.jpg",
        aiMetadata: { confidence: 0.93 },
        status: "PROCESSED",
        createdAt: "2026-07-29T08:00:00.000Z",
        robot: {
            id: "00000000-0000-4000-8000-000000000030",
            name: "Lobby Robot",
            location: "Main lobby",
            status: "Online",
        },
    },
};

export const operationsPaths: OpenApiPaths = {
    "/api/events/report": {
        post: publicOperation({
            operationId: "reportRobotEvent",
            summary: "Report a robot Event",
            description: "Receives a source Event from a robot and queues its frame for processing. A qualifying Event may create a persistent Alert.",
            tags: ["Events"],
            requestBody: {
                required: true,
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            required: ["frame", "robot_id", "event_type"],
                            properties: {
                                frame: { type: "string", format: "binary", description: "Event frame image." },
                                robot_id: { type: "string", format: "uuid" },
                                event_type: { type: "string", example: "face_detected_unknown" },
                                metadata: {
                                    type: "string",
                                    description: "JSON-encoded object parsed by the route.",
                                    example: "{\"confidence\":0.93}",
                                },
                            },
                        },
                        encoding: { frame: { contentType: "image/jpeg, image/png, image/webp" } },
                    },
                },
            },
            responses: {
                "201": jsonResponse("Event persisted and queued.", {
                    type: "object",
                    required: ["message", "eventId"],
                    properties: {
                        message: { type: "string" },
                        eventId: { type: "string", format: "uuid" },
                    },
                }, {
                    message: "Event received and queued for processing",
                    eventId: "00000000-0000-4000-8000-000000000020",
                }),
            },
        }, { validation: true }),
    },
    "/api/events": {
        get: secured({
            operationId: "listEvents",
            summary: "List recent tenant Events",
            description: `${tenantScopedDescription} Events are robot-reported source records, not persistent operational Alerts.`,
            tags: ["Events"],
            responses: {
                "200": jsonResponse("Up to 200 recent Events in the frontend robot-event shape.", {
                    type: "object",
                    required: ["ok", "events"],
                    properties: {
                        ok: { type: "boolean", example: true },
                        events: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string", format: "uuid" },
                                    type: { type: "string", nullable: true },
                                    is_alert: { type: "boolean" },
                                    timestamp: { type: "string", format: "date-time" },
                                    image_filename: { type: "string" },
                                    detections: { type: "array", items: {} },
                                    source: { type: "string", enum: ["SentryX"] },
                                    status: { type: "string" },
                                },
                            },
                        },
                    },
                }),
            },
        }),
    },
    "/api/events/{id}/image": {
        get: {
            operationId: "getEventImage",
            summary: "Get a stored Event image",
            description: "Public image route used by image elements. It does not alter the Event or any linked Alert.",
            tags: ["Events"],
            security: [],
            parameters: [idParameter("Event UUID")],
            responses: {
                "200": imageResponse,
                "404": { $ref: "#/components/responses/NotFound" },
                "500": { $ref: "#/components/responses/ServerError" },
            },
        },
    },
    "/api/alerts": {
        get: secured({
            operationId: "listAlerts",
            summary: "List tenant-wide Alert history",
            description: `${tenantScopedDescription} This is the global Alert history. It is distinct from an operator's assigned OnCall tasks.`,
            tags: ["Alerts"],
            parameters: [
                {
                    name: "status",
                    in: "query",
                    schema: { type: "string", enum: ["all", "active", "resolved"], default: "all" },
                    description: "active includes OPEN and IN_PROGRESS.",
                },
                parameterRef("Limit"),
                parameterRef("Offset"),
                { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
                { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
                { name: "eventType", in: "query", schema: { type: "string" } },
                { name: "robotId", in: "query", schema: { type: "string", format: "uuid" } },
                { name: "assignedUserId", in: "query", schema: { type: "string", format: "uuid" } },
            ],
            responses: {
                "200": jsonResponse("Filtered tenant-wide Alert history.", ref("AlertListResponse"), {
                    ok: true,
                    alerts: [alertExample],
                    counts: { all: 1, active: 1, resolved: 0 },
                    pagination: { limit: 50, offset: 0, total: 1 },
                }),
            },
        }, { validation: true }),
    },
    "/api/alerts/{id}": {
        get: secured({
            operationId: "getAlert",
            summary: "Get one Alert",
            description: tenantScopedDescription,
            tags: ["Alerts"],
            parameters: [idParameter("Alert UUID")],
            responses: {
                "200": jsonResponse("Alert.", {
                    type: "object",
                    required: ["ok", "alert"],
                    properties: { ok: { type: "boolean" }, alert: ref("Alert") },
                }),
            },
        }, { notFound: true }),
    },
    "/api/alerts/{id}/status": {
        patch: secured({
            operationId: "updateAlertStatus",
            summary: "Advance an Alert status",
            description: `${tenantScopedDescription} Valid transitions are OPEN to IN_PROGRESS or RESOLVED, and IN_PROGRESS to RESOLVED. RESOLVED is terminal. Resolution notes are optional and are applied when resolving.`,
            tags: ["Alerts"],
            parameters: [idParameter("Alert UUID")],
            requestBody: jsonBody({
                type: "object",
                required: ["status"],
                properties: {
                    status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "RESOLVED"] },
                    resolutionNotes: { type: "string", nullable: true },
                },
            }, true, { status: "RESOLVED", resolutionNotes: "Reviewed by the duty operator; no threat found." }),
            responses: {
                "200": jsonResponse("Updated Alert.", {
                    type: "object",
                    required: ["ok", "alert"],
                    properties: { ok: { type: "boolean" }, alert: ref("Alert") },
                }, {
                    ok: true,
                    alert: {
                        ...alertExample,
                        status: "RESOLVED",
                        resolvedAt: "2026-07-29T08:10:00.000Z",
                        resolutionNotes: "Reviewed by the duty operator; no threat found.",
                    },
                }),
            },
        }, { validation: true, notFound: true, conflict: true }),
    },
};

