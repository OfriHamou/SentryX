import type { OpenApiObject } from "../types";

const uuid = { type: "string", format: "uuid" };
const dateTime = { type: "string", format: "date-time" };

export const commonSchemas: Record<string, OpenApiObject> = {
    ErrorResponse: {
        type: "object",
        description: "Error responses use either message or error, matching the existing controller.",
        properties: {
            ok: { type: "boolean", example: false },
            message: { type: "string", example: "Internal server error" },
            error: { type: "string", example: "Failed to process request" },
        },
        additionalProperties: true,
    },
    SuccessResponse: {
        type: "object",
        properties: {
            ok: { type: "boolean", example: true },
            message: { type: "string" },
        },
        additionalProperties: true,
    },
    Pagination: {
        type: "object",
        required: ["limit", "offset", "total"],
        properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, example: 50 },
            offset: { type: "integer", minimum: 0, example: 0 },
            total: { type: "integer", minimum: 0, example: 1 },
        },
    },
    PermissionMap: {
        type: "object",
        additionalProperties: {
            type: "array",
            items: { type: "string" },
        },
        example: { alerts: ["read"], on_call: ["read"] },
    },
    AuthenticatedUser: {
        type: "object",
        required: ["id", "email", "status"],
        properties: {
            id: uuid,
            email: { type: "string", format: "email", example: "operator@example.test" },
            fullName: { type: "string", nullable: true, example: "Alex Operator" },
            phone: { type: "string", nullable: true },
            jobTitle: { type: "string", nullable: true },
            tenantId: { ...uuid, nullable: true },
            roleId: { type: "integer", nullable: true, example: 4 },
            roleName: { type: "string", nullable: true, example: "SECURITY_OPERATOR" },
            status: { type: "string", enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED"] },
            createdAt: dateTime,
            approvedAt: { ...dateTime, nullable: true },
            approvedBy: { ...uuid, nullable: true },
            rejectedAt: { ...dateTime, nullable: true },
            rejectedBy: { ...uuid, nullable: true },
            rejectionReason: { type: "string", nullable: true },
            tenantName: { type: "string" },
            tenantInviteCode: { type: "string", nullable: true },
            allowedPages: { $ref: "#/components/schemas/PermissionMap" },
        },
    },
    Tenant: {
        type: "object",
        required: ["id", "name", "createdAt"],
        properties: {
            id: uuid,
            name: { type: "string", example: "Example Organization" },
            inviteCode: { type: "string", nullable: true, example: "ORG-EXA-A1B2C3D4" },
            createdAt: dateTime,
            tenantLicenses: { type: "array", items: { type: "object", additionalProperties: true } },
            robots: { type: "array", items: { $ref: "#/components/schemas/Robot" } },
        },
    },
    Role: {
        type: "object",
        required: ["id", "roleName", "allowedPages"],
        properties: {
            id: { type: "integer", example: 4 },
            roleName: { type: "string", example: "SECURITY_OPERATOR" },
            allowedPages: { $ref: "#/components/schemas/PermissionMap" },
        },
    },
    License: {
        type: "object",
        required: ["code"],
        properties: {
            code: { type: "string", example: "ALERTS" },
            description: { type: "string", nullable: true, example: "Operational alert management" },
            createdAt: dateTime,
        },
    },
    Robot: {
        type: "object",
        required: ["id", "name", "status"],
        properties: {
            id: uuid,
            name: { type: "string", example: "Lobby Robot" },
            location: { type: "string", nullable: true, example: "Main lobby" },
            robotUrl: { type: "string", nullable: true },
            status: { type: "string", example: "Online" },
            lastConnection: { ...dateTime, nullable: true },
            updatedAt: dateTime,
        },
    },
    OrganizationRobot: {
        type: "object",
        description: "Tenant-scoped Robot management view. Connectivity fields are system-managed.",
        required: ["id", "name", "location", "status", "lastConnection", "updatedAt", "archivedAt"],
        properties: {
            id: uuid,
            name: { type: "string", maxLength: 25, example: "Lobby Robot" },
            location: { type: "string", maxLength: 35, nullable: true, example: "Main lobby" },
            status: { type: "string", readOnly: true, example: "Offline" },
            lastConnection: { ...dateTime, nullable: true, readOnly: true },
            updatedAt: { ...dateTime, readOnly: true },
            archivedAt: {
                ...dateTime,
                nullable: true,
                readOnly: true,
                description: "Lifecycle archive timestamp. Null means active.",
            },
        },
    },
    Event: {
        type: "object",
        required: ["id", "eventType", "status", "createdAt"],
        properties: {
            id: uuid,
            eventType: { type: "string", nullable: true, example: "face_detected_unknown" },
            imagePath: { type: "string", nullable: true, example: "robot-01/event-frame.jpg" },
            aiMetadata: { type: "object", nullable: true, additionalProperties: true },
            status: { type: "string", example: "PENDING" },
            createdAt: dateTime,
            robot: { allOf: [{ $ref: "#/components/schemas/Robot" }], nullable: true },
        },
    },
};

export const commonParameters: Record<string, OpenApiObject> = {
    Limit: {
        name: "limit",
        in: "query",
        description: "Maximum number of records to return (values above 200 are capped).",
        schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    },
    Offset: {
        name: "offset",
        in: "query",
        schema: { type: "integer", minimum: 0, default: 0 },
    },
    TargetApp: {
        name: "targetApp",
        in: "query",
        schema: { type: "string", enum: ["CUSTOMER", "ORGANIZATION", "ADMIN"] },
    },
};

export const commonResponses: Record<string, OpenApiObject> = {
    ValidationError: {
        description: "The request failed validation.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
    },
    Unauthorized: {
        description: "Missing, invalid, or expired access-token authentication.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
    },
    Forbidden: {
        description: "The authenticated user lacks the required permission.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
    },
    NotFound: {
        description: "The resource does not exist or is not accessible in the authenticated tenant.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
    },
    Conflict: {
        description: "The requested change conflicts with existing state.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
    },
    ServerError: {
        description: "An unexpected server error occurred.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
    },
};
