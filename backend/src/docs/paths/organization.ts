import { idParameter, jsonBody, ref, secured, tenantScopedDescription } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const jsonResponse = (description: string, schema: OpenApiObject): OpenApiObject => ({
    description,
    content: { "application/json": { schema } },
});
const arrayOf = (name: string): OpenApiObject => ({ type: "array", items: ref(name) });
const userId = idParameter("Organization user UUID");
const shiftId = idParameter("Security Shift UUID");
const visitorId = idParameter("Visitor UUID");
const shiftBody = {
    type: "object",
    required: ["name", "startAt", "endAt", "assignedUserId"],
    properties: {
        name: { type: "string", example: "Night shift" },
        startAt: { type: "string", format: "date-time" },
        endAt: { type: "string", format: "date-time" },
        assignedUserId: { type: "string", format: "uuid" },
        notes: { type: "string", nullable: true },
    },
};
const visitorMultipart = (requireFaceImage: boolean) => ({
    required: true,
    content: {
        "multipart/form-data": {
            schema: {
                type: "object",
                required: [
                    "name",
                    "phone",
                    "purpose",
                    "hostUserId",
                    "startAt",
                    "endAt",
                    ...(requireFaceImage ? ["faceImage"] : []),
                ],
                properties: {
                    name: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string", format: "email", nullable: true },
                    purpose: { type: "string" },
                    hostUserId: { type: "string", format: "uuid" },
                    startAt: { type: "string", format: "date-time" },
                    endAt: { type: "string", format: "date-time" },
                    faceImage: {
                        type: "string",
                        format: "binary",
                        description: "Required when creating; optional when updating. JPEG, PNG, or WebP, maximum 5 MB.",
                    },
                },
            },
        },
    },
});

export const organizationPaths: OpenApiPaths = {
    "/api/organization/me": {
        get: secured({
            operationId: "getMyOrganization",
            summary: "Get the authenticated user's organization",
            description: tenantScopedDescription,
            tags: ["Organization"],
            responses: {
                "200": jsonResponse("Organization and current user.", {
                    type: "object",
                    required: ["tenant", "currentUser"],
                    properties: {
                        tenant: { allOf: [ref("Tenant")], nullable: true },
                        currentUser: ref("AuthenticatedUser"),
                    },
                }),
            },
        }, { notFound: true }),
    },
    "/api/organization/summary": {
        get: secured({
            operationId: "getOrganizationSummary",
            summary: "Get organization user-access totals",
            description: tenantScopedDescription,
            tags: ["Organization"],
            responses: {
                "200": jsonResponse("Organization summary.", {
                    type: "object",
                    required: ["usersCount", "customerAccessCount", "organizationAccessCount"],
                    properties: {
                        usersCount: { type: "integer" },
                        customerAccessCount: { type: "integer" },
                        organizationAccessCount: { type: "integer" },
                    },
                }),
            },
        }),
    },
    "/api/organization/users": {
        get: secured({
            operationId: "listOrganizationUsers",
            summary: "List organization users",
            description: tenantScopedDescription,
            tags: ["Organization"],
            responses: { "200": jsonResponse("Organization users.", arrayOf("AuthenticatedUser")) },
        }),
        post: secured({
            operationId: "createOrganizationUser",
            summary: "Create an approved organization user",
            description: tenantScopedDescription,
            tags: ["Organization"],
            requestBody: jsonBody({
                type: "object",
                required: ["fullName", "email", "password", "roleId"],
                properties: {
                    fullName: { type: "string" },
                    email: { type: "string", format: "email" },
                    password: { type: "string", format: "password", writeOnly: true },
                    roleId: { type: "integer", minimum: 1 },
                },
            }),
            responses: { "201": jsonResponse("Created user.", ref("AuthenticatedUser")) },
        }, { validation: true, notFound: true, conflict: true }),
    },
    "/api/organization/users/{id}": {
        put: secured({
            operationId: "updateOrganizationUser",
            summary: "Update an organization user",
            description: tenantScopedDescription,
            tags: ["Organization"],
            parameters: [userId],
            requestBody: jsonBody({
                type: "object",
                properties: {
                    fullName: { type: "string" },
                    roleId: { type: "integer", minimum: 1 },
                },
            }),
            responses: { "200": jsonResponse("Updated user.", ref("AuthenticatedUser")) },
        }, { validation: true, notFound: true }),
    },
    "/api/organization/roles": {
        get: secured({
            operationId: "listOrganizationRoles",
            summary: "List roles assignable within an organization",
            tags: ["Organization", "Roles"],
            responses: { "200": jsonResponse("Assignable roles.", arrayOf("Role")) },
        }),
    },
    "/api/organization/security-shifts": {
        get: secured({
            operationId: "listSecurityShifts",
            summary: "List Security Shifts",
            description: tenantScopedDescription,
            tags: ["Security Shifts"],
            parameters: [
                { name: "from", in: "query", schema: { type: "string", format: "date-time" }, description: "Include shifts ending at or after this instant." },
                { name: "to", in: "query", schema: { type: "string", format: "date-time" }, description: "Include shifts starting at or before this instant." },
            ],
            responses: { "200": jsonResponse("Security Shifts.", arrayOf("SecurityShift")) },
        }, { validation: true }),
        post: secured({
            operationId: "createSecurityShift",
            summary: "Create a Security Shift",
            description: `${tenantScopedDescription} The assigned user must be an approved SECURITY_OPERATOR. Non-cancelled shifts cannot overlap.`,
            tags: ["Security Shifts"],
            requestBody: jsonBody(shiftBody),
            responses: { "201": jsonResponse("Created shift.", ref("SecurityShift")) },
        }, { validation: true, conflict: true }),
    },
    "/api/organization/security-shifts/current": {
        get: secured({
            operationId: "getCurrentSecurityShift",
            summary: "Get the tenant's current Security Shift",
            description: `${tenantScopedDescription} Returns JSON null when no shift is active.`,
            tags: ["Security Shifts"],
            responses: {
                "200": jsonResponse("Current shift or null.", { allOf: [ref("SecurityShift")], nullable: true }),
            },
        }),
    },
    "/api/organization/security-shifts/operators": {
        get: secured({
            operationId: "listSecurityShiftOperators",
            summary: "List approved Security Operators",
            description: tenantScopedDescription,
            tags: ["Security Shifts"],
            responses: { "200": jsonResponse("Eligible operators.", arrayOf("AuthenticatedUser")) },
        }),
    },
    "/api/organization/security-shifts/{id}": {
        put: secured({
            operationId: "updateSecurityShift",
            summary: "Update a Security Shift",
            description: `${tenantScopedDescription} Non-cancelled shifts cannot overlap.`,
            tags: ["Security Shifts"],
            parameters: [shiftId],
            requestBody: jsonBody(shiftBody),
            responses: { "200": jsonResponse("Updated shift.", ref("SecurityShift")) },
        }, { validation: true, notFound: true, conflict: true }),
        delete: secured({
            operationId: "cancelSecurityShift",
            summary: "Cancel a Security Shift",
            description: `${tenantScopedDescription} This sets the shift status to CANCELLED.`,
            tags: ["Security Shifts"],
            parameters: [shiftId],
            responses: { "200": jsonResponse("Cancelled shift.", ref("SecurityShift")) },
        }, { notFound: true }),
    },
    "/api/organization/visitors": {
        get: secured({
            operationId: "listVisitors",
            summary: "List Visitors",
            description: tenantScopedDescription,
            tags: ["Visitors"],
            parameters: [{
                name: "view",
                in: "query",
                schema: { type: "string", enum: ["current", "history"], default: "current" },
                description: "current returns scheduled/active visitors; history returns expired/completed/cancelled visitors.",
            }],
            responses: { "200": jsonResponse("Visitors.", arrayOf("Visitor")) },
        }),
        post: secured({
            operationId: "createVisitor",
            summary: "Create a Visitor",
            description: `${tenantScopedDescription} A face image is required and is synchronized to robots only while the visit is active.`,
            tags: ["Visitors"],
            requestBody: visitorMultipart(true),
            responses: { "201": jsonResponse("Created visitor.", ref("Visitor")) },
        }, { validation: true }),
    },
    "/api/organization/visitors/hosts": {
        get: secured({
            operationId: "listVisitorHosts",
            summary: "List approved Visitor hosts",
            description: tenantScopedDescription,
            tags: ["Visitors"],
            responses: { "200": jsonResponse("Eligible hosts.", arrayOf("AlertAssignedUser")) },
        }),
    },
    "/api/organization/visitors/{id}": {
        get: secured({
            operationId: "getVisitor",
            summary: "Get a Visitor",
            description: tenantScopedDescription,
            tags: ["Visitors"],
            parameters: [visitorId],
            responses: { "200": jsonResponse("Visitor.", ref("Visitor")) },
        }, { notFound: true }),
        put: secured({
            operationId: "updateVisitor",
            summary: "Update a Visitor",
            description: `${tenantScopedDescription} Cancelled visitors cannot be edited. A replacement face image is optional.`,
            tags: ["Visitors"],
            parameters: [visitorId],
            requestBody: visitorMultipart(false),
            responses: { "200": jsonResponse("Updated visitor.", ref("Visitor")) },
        }, { validation: true, notFound: true }),
        delete: secured({
            operationId: "cancelVisitor",
            summary: "Cancel a Visitor",
            description: `${tenantScopedDescription} This sets the visitor status to CANCELLED.`,
            tags: ["Visitors"],
            parameters: [visitorId],
            responses: { "200": jsonResponse("Cancelled visitor.", ref("Visitor")) },
        }, { notFound: true }),
    },
    "/api/organization/visitors/{id}/image": {
        get: {
            operationId: "getVisitorImage",
            summary: "Get a Visitor face image",
            description: "Public image-friendly route. The controller returns the stored image for the visitor ID.",
            tags: ["Visitors"],
            security: [],
            parameters: [visitorId],
            responses: {
                "200": {
                    description: "Visitor image.",
                    content: {
                        "image/jpeg": { schema: { type: "string", format: "binary" } },
                        "image/png": { schema: { type: "string", format: "binary" } },
                        "image/webp": { schema: { type: "string", format: "binary" } },
                    },
                },
                "404": { $ref: "#/components/responses/NotFound" },
                "500": { $ref: "#/components/responses/ServerError" },
            },
        },
    },
};
