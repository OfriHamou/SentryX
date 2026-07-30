import { idParameter, jsonBody, parameterRef, ref, secured } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const jsonResponse = (description: string, schema: OpenApiObject): OpenApiObject => ({
    description,
    content: { "application/json": { schema } },
});

const permissionDescription = (permission: "read" | "write") =>
    `Platform-wide Admin operation. Requires \`admin_alerts:${permission}\`; the tenant-scoped \`alerts\` permission does not grant access.`;

const alertResponse = jsonResponse("Platform Admin Alert.", {
    type: "object",
    required: ["ok", "alert"],
    properties: {
        ok: { type: "boolean", example: true },
        alert: ref("AdminAlert"),
    },
});

export const adminAlertPaths: OpenApiPaths = {
    "/api/admin/alerts": {
        get: secured({
            operationId: "listAdminAlerts",
            summary: "List Alerts across all Tenants",
            description: `${permissionDescription("read")} Results are not restricted to the authenticated Admin's Tenant. Counts retain tenant, date, and search filters but ignore the selected status tab.`,
            tags: ["Admin Alerts"],
            parameters: [
                {
                    name: "status",
                    in: "query",
                    schema: {
                        type: "string",
                        enum: ["all", "active", "open", "in_progress", "resolved"],
                        default: "all",
                    },
                    description: "active includes OPEN and IN_PROGRESS.",
                },
                {
                    name: "tenantId",
                    in: "query",
                    schema: { type: "string", format: "uuid" },
                    description: "Optionally restrict results and counts to one Tenant.",
                },
                {
                    name: "from",
                    in: "query",
                    schema: { type: "string", format: "date-time" },
                    description: "Inclusive Alert creation timestamp lower bound.",
                },
                {
                    name: "to",
                    in: "query",
                    schema: { type: "string", format: "date-time" },
                    description: "Inclusive Alert creation timestamp upper bound.",
                },
                {
                    name: "search",
                    in: "query",
                    schema: { type: "string", maxLength: 100 },
                    description: "Search Alert ID, Tenant, Event type, Robot, location, or assigned user.",
                },
                parameterRef("Limit"),
                parameterRef("Offset"),
            ],
            responses: {
                "200": jsonResponse("Platform-wide filtered Alerts, counts, and pagination.", ref("AdminAlertListResponse")),
            },
        }, { validation: true }),
    },
    "/api/admin/alerts/{id}": {
        get: secured({
            operationId: "getAdminAlert",
            summary: "Get a platform Admin Alert",
            description: `${permissionDescription("read")} Loads the Alert by ID across all Tenants with its Tenant, Event, Robot, assignment, shift, and resolution projection.`,
            tags: ["Admin Alerts"],
            parameters: [idParameter("Alert UUID")],
            responses: { "200": alertResponse },
        }, { validation: true, notFound: true }),
    },
    "/api/admin/alerts/{id}/status": {
        patch: secured({
            operationId: "updateAdminAlertStatus",
            summary: "Advance a platform Admin Alert status",
            description: `${permissionDescription("write")} Valid transitions are OPEN to IN_PROGRESS or RESOLVED and IN_PROGRESS to RESOLVED. RESOLVED is terminal; same-state changes and reopening return 409. Resolving records the authenticated Admin and current time without changing assignment.`,
            tags: ["Admin Alerts"],
            parameters: [idParameter("Alert UUID")],
            requestBody: jsonBody({
                type: "object",
                required: ["status"],
                properties: {
                    status: { type: "string", enum: ["IN_PROGRESS", "RESOLVED"] },
                    resolutionNotes: {
                        type: "string",
                        maxLength: 1000,
                        description: "Optional. Trimmed and stored as null when empty.",
                    },
                },
                additionalProperties: false,
            }, true, {
                status: "RESOLVED",
                resolutionNotes: "Reviewed by the platform operations team.",
            }),
            responses: { "200": alertResponse },
        }, { validation: true, notFound: true, conflict: true }),
    },
    "/api/admin/alerts/{id}/image": {
        get: secured({
            operationId: "getAdminAlertImage",
            summary: "Get an Admin Alert Event image",
            description: `${permissionDescription("read")} Serves the linked Event image from inside the configured Event media directory. The Admin frontend must request it with JWT authentication.`,
            tags: ["Admin Alerts"],
            parameters: [idParameter("Alert UUID")],
            responses: {
                "200": {
                    description: "Event image bytes.",
                    content: {
                        "image/jpeg": { schema: { type: "string", format: "binary" } },
                        "image/png": { schema: { type: "string", format: "binary" } },
                        "image/webp": { schema: { type: "string", format: "binary" } },
                    },
                },
            },
        }, { validation: true, notFound: true }),
    },
};
