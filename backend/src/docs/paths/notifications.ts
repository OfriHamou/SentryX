import { idParameter, jsonBody, parameterRef, ref, secured, tenantScopedDescription } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const jsonResponse = (description: string, schema: OpenApiObject, example?: unknown): OpenApiObject => ({
    description,
    content: { "application/json": { schema, ...(example === undefined ? {} : { example }) } },
});
const notificationExample = {
    id: "00000000-0000-4000-8000-000000000041",
    eventId: "00000000-0000-4000-8000-000000000020",
    alertId: "00000000-0000-4000-8000-000000000021",
    title: "Unknown person detected",
    message: "Lobby Robot detected an unknown person.",
    severity: "warning",
    targetApps: ["CUSTOMER", "ORGANIZATION"],
    isRead: false,
    readAt: null,
    createdAt: "2026-07-29T08:00:01.000Z",
    alert: {
        id: "00000000-0000-4000-8000-000000000021",
        status: "OPEN",
        displayTitle: "Unknown person detected",
        startedAt: null,
        resolvedAt: null,
    },
    event: {
        id: "00000000-0000-4000-8000-000000000020",
        eventType: "face_detected_unknown",
        imagePath: "robot-01/frame.jpg",
        status: "PROCESSED",
        createdAt: "2026-07-29T08:00:00.000Z",
    },
    robot: {
        id: "00000000-0000-4000-8000-000000000030",
        name: "Lobby Robot",
        location: "Main lobby",
        status: "Online",
    },
    tenant: {
        id: "00000000-0000-4000-8000-000000000010",
        name: "Example Organization",
    },
    metadata: { confidence: 0.93 },
};

export const notificationPaths: OpenApiPaths = {
    "/api/notifications": {
        get: secured({
            operationId: "listNotifications",
            summary: "List the authenticated user's Notifications",
            description: `${tenantScopedDescription} Results use per-user read state and may link an Event, Alert, Robot, and Tenant. Alert linkage is nullable for manual or legacy Notifications. Reading a Notification does not change Alert status.`,
            tags: ["Notifications"],
            parameters: [
                parameterRef("TargetApp"),
                {
                    name: "status",
                    in: "query",
                    schema: { type: "string", enum: ["all", "read", "unread"], default: "all" },
                },
                { ...parameterRef("Limit"), description: "Maximum 100 for Notification queries." },
                parameterRef("Offset"),
            ],
            responses: {
                "200": jsonResponse("Notifications visible to the authenticated user.", ref("NotificationListResponse"), {
                    ok: true,
                    notifications: [notificationExample],
                    pagination: { limit: 50, offset: 0, total: 1 },
                }),
            },
        }, { validation: true }),
        post: secured({
            operationId: "createNotification",
            summary: "Create a Notification",
            description: `${tenantScopedDescription} The event, robot, and recipient IDs must belong to the tenant. If recipientUserIds is omitted, the authenticated user is the recipient.`,
            tags: ["Notifications"],
            requestBody: jsonBody({
                type: "object",
                required: ["targetApps"],
                properties: {
                    title: { type: "string", nullable: true },
                    message: { type: "string", nullable: true },
                    severity: { type: "string", example: "warning" },
                    targetApps: {
                        type: "array",
                        minItems: 1,
                        items: { type: "string", enum: ["CUSTOMER", "ORGANIZATION", "ADMIN"] },
                    },
                    metadata: { type: "object", additionalProperties: true },
                    eventId: { type: "string", format: "uuid", nullable: true },
                    robotId: {
                        type: "string",
                        format: "uuid",
                        description: "Required if eventId is omitted; if both are supplied, it must match the Event's robot.",
                    },
                    recipientUserIds: { type: "array", items: { type: "string", format: "uuid" } },
                },
            }),
            responses: {
                "201": jsonResponse("Notification created.", {
                    type: "object",
                    required: ["ok", "notification", "recipientCount"],
                    properties: {
                        ok: { type: "boolean" },
                        notification: {
                            oneOf: [
                                ref("Notification"),
                                {
                                    type: "object",
                                    required: ["id"],
                                    properties: { id: { type: "string", format: "uuid" } },
                                    description: "Fallback shape if the newly created recipient projection cannot be reloaded.",
                                },
                            ],
                        },
                        recipientCount: { type: "integer", minimum: 1 },
                    },
                }),
            },
        }, { validation: true, notFound: true }),
    },
    "/api/notifications/unread-count": {
        get: secured({
            operationId: "getUnreadNotificationCount",
            summary: "Count unread Notifications",
            description: "Counts the authenticated user's unread recipient records. It does not inspect or change Alert status.",
            tags: ["Notifications"],
            parameters: [parameterRef("TargetApp")],
            responses: {
                "200": jsonResponse("Unread count.", {
                    type: "object",
                    required: ["ok", "unreadCount"],
                    properties: {
                        ok: { type: "boolean", example: true },
                        unreadCount: { type: "integer", minimum: 0, example: 3 },
                    },
                }),
            },
        }, { validation: true }),
    },
    "/api/notifications/read-all": {
        patch: secured({
            operationId: "markAllNotificationsRead",
            summary: "Mark all matching Notifications read",
            description: "Updates the authenticated user's recipient read state only. It does not change linked Alert status.",
            tags: ["Notifications"],
            parameters: [parameterRef("TargetApp")],
            responses: {
                "200": jsonResponse("Read states updated.", {
                    type: "object",
                    required: ["ok", "updatedCount"],
                    properties: {
                        ok: { type: "boolean", example: true },
                        updatedCount: { type: "integer", minimum: 0 },
                    },
                }),
            },
        }, { validation: true }),
    },
    "/api/notifications/{id}/read": {
        patch: secured({
            operationId: "markNotificationRead",
            summary: "Mark a Notification read",
            description: "Updates only the authenticated user's recipient read state; it does not change Alert status.",
            tags: ["Notifications"],
            parameters: [idParameter("Notification UUID")],
            responses: {
                "200": jsonResponse("Updated Notification.", {
                    type: "object",
                    required: ["ok", "notification"],
                    properties: { ok: { type: "boolean" }, notification: ref("Notification") },
                }),
            },
        }, { notFound: true }),
    },
    "/api/notifications/{id}/unread": {
        patch: secured({
            operationId: "markNotificationUnread",
            summary: "Mark a Notification unread",
            description: "Updates only the authenticated user's recipient read state; it does not change Alert status.",
            tags: ["Notifications"],
            parameters: [idParameter("Notification UUID")],
            responses: {
                "200": jsonResponse("Updated Notification.", {
                    type: "object",
                    required: ["ok", "notification"],
                    properties: { ok: { type: "boolean" }, notification: ref("Notification") },
                }),
            },
        }, { notFound: true }),
    },
};
