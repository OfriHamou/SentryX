import { idParameter, jsonBody, ref, secured } from "../helpers";
import type { OpenApiObject, OpenApiPaths } from "../types";

const arrayOf = (schema: string): OpenApiObject => ({ type: "array", items: ref(schema) });
const successArray = (schema: string, description: string): OpenApiObject => ({
    description,
    content: { "application/json": { schema: arrayOf(schema) } },
});
const tenantId = idParameter("Tenant UUID");
const roleId = { ...idParameter("Role numeric ID"), schema: { type: "integer", minimum: 1 } };

export const administrationPaths: OpenApiPaths = {
    "/api/tenants": {
        get: secured({
            operationId: "listTenants",
            summary: "List tenants",
            tags: ["Tenants"],
            responses: { "200": successArray("Tenant", "Tenants with their loaded licenses and robots.") },
        }),
        post: secured({
            operationId: "createTenant",
            summary: "Create a tenant",
            tags: ["Tenants"],
            requestBody: jsonBody({
                type: "object",
                required: ["name"],
                properties: { name: { type: "string", example: "Example Organization" } },
            }),
            responses: {
                "201": { description: "Tenant created.", content: { "application/json": { schema: ref("Tenant") } } },
            },
        }, { validation: true, conflict: true }),
    },
    "/api/tenants/{id}": {
        get: secured({
            operationId: "getTenant",
            summary: "Get a tenant",
            tags: ["Tenants"],
            parameters: [tenantId],
            responses: { "200": { description: "Tenant.", content: { "application/json": { schema: ref("Tenant") } } } },
        }, { notFound: true }),
        put: secured({
            operationId: "updateTenant",
            summary: "Update a tenant",
            tags: ["Tenants"],
            parameters: [tenantId],
            requestBody: jsonBody({ type: "object", properties: { name: { type: "string" } } }),
            responses: { "200": { description: "Updated tenant.", content: { "application/json": { schema: ref("Tenant") } } } },
        }, { validation: true, notFound: true }),
        delete: secured({
            operationId: "deleteTenant",
            summary: "Delete a tenant",
            tags: ["Tenants"],
            parameters: [tenantId],
            responses: { "200": { description: "Tenant deleted.", content: { "application/json": { schema: ref("SuccessResponse") } } } },
        }, { notFound: true }),
    },
    "/api/tenants/{id}/licenses": {
        get: secured({
            operationId: "listTenantLicenses",
            summary: "List a tenant's licenses",
            tags: ["Tenants", "Licenses"],
            parameters: [tenantId],
            responses: { "200": successArray("License", "Assigned licenses.") },
        }, { notFound: true }),
        post: secured({
            operationId: "addTenantLicense",
            summary: "Assign a license to a tenant",
            tags: ["Tenants", "Licenses"],
            parameters: [tenantId],
            requestBody: jsonBody({
                type: "object",
                required: ["licenseCode"],
                properties: {
                    licenseCode: { type: "string" },
                    expirationDate: { type: "string", format: "date-time", nullable: true },
                },
            }),
            responses: { "201": { description: "License assignment created.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
        }, { validation: true, conflict: true }),
    },
    "/api/tenants/{id}/licenses/{licenseCode}": {
        delete: secured({
            operationId: "removeTenantLicense",
            summary: "Remove a tenant license",
            tags: ["Tenants", "Licenses"],
            parameters: [
                tenantId,
                { name: "licenseCode", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { "200": { description: "License removed.", content: { "application/json": { schema: ref("SuccessResponse") } } } },
        }, { notFound: true }),
    },
    "/api/tenants/{id}/robots": {
        get: secured({
            operationId: "listTenantRobots",
            summary: "List a tenant's robots",
            tags: ["Tenants", "Robots"],
            parameters: [tenantId],
            responses: { "200": successArray("Robot", "Tenant robots.") },
        }, { notFound: true }),
    },
    "/api/licenses": {
        get: secured({
            operationId: "listLicenses",
            summary: "List licenses",
            tags: ["Licenses"],
            responses: { "200": successArray("License", "Licenses.") },
        }),
        post: secured({
            operationId: "createLicense",
            summary: "Create a license",
            tags: ["Licenses"],
            requestBody: jsonBody({
                type: "object",
                required: ["code"],
                properties: { code: { type: "string" }, description: { type: "string", nullable: true } },
            }),
            responses: { "201": { description: "License created.", content: { "application/json": { schema: ref("License") } } } },
        }, { validation: true, conflict: true }),
    },
    "/api/licenses/{code}": {
        delete: secured({
            operationId: "deleteLicense",
            summary: "Delete a license",
            tags: ["Licenses"],
            parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "License deleted.", content: { "application/json": { schema: ref("SuccessResponse") } } } },
        }, { notFound: true }),
    },
    "/api/roles": {
        get: secured({
            operationId: "listRoles",
            summary: "List roles",
            tags: ["Roles"],
            responses: { "200": successArray("Role", "Roles.") },
        }),
        post: secured({
            operationId: "createRole",
            summary: "Create a role",
            tags: ["Roles"],
            requestBody: jsonBody({
                type: "object",
                required: ["roleName", "allowedPages"],
                properties: { roleName: { type: "string" }, allowedPages: ref("PermissionMap") },
            }),
            responses: { "201": { description: "Role created.", content: { "application/json": { schema: ref("Role") } } } },
        }, { validation: true, conflict: true }),
    },
    "/api/roles/{id}": {
        get: secured({
            operationId: "getRole",
            summary: "Get a role",
            tags: ["Roles"],
            parameters: [roleId],
            responses: { "200": { description: "Role.", content: { "application/json": { schema: ref("Role") } } } },
        }, { notFound: true }),
        put: secured({
            operationId: "updateRole",
            summary: "Update a role",
            tags: ["Roles"],
            parameters: [roleId],
            requestBody: jsonBody({
                type: "object",
                required: ["roleName", "allowedPages"],
                properties: { roleName: { type: "string" }, allowedPages: ref("PermissionMap") },
            }),
            responses: { "200": { description: "Updated role.", content: { "application/json": { schema: ref("Role") } } } },
        }, { validation: true, notFound: true, conflict: true }),
    },
};

