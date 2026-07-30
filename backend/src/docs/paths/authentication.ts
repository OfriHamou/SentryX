import { idParameter, jsonBody, publicOperation, ref, secured } from "../helpers";
import type { OpenApiPaths } from "../types";

const userStatus = { type: "string", enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED"] };
const authResponse = {
    type: "object",
    required: ["accessToken", "refreshToken", "user"],
    properties: {
        accessToken: { type: "string", description: "JWT access token used with bearerAuth." },
        refreshToken: { type: "string", description: "Refresh credential used only in refresh/logout request bodies." },
        user: ref("AuthenticatedUser"),
    },
};
const refreshBody = {
    type: "object",
    required: ["refreshToken"],
    properties: { refreshToken: { type: "string" } },
};

export const authenticationPaths: OpenApiPaths = {
    "/api/auth/register": {
        post: publicOperation({
            operationId: "register",
            summary: "Request organization registration",
            tags: ["Authentication"],
            requestBody: jsonBody({
                type: "object",
                required: ["tenantInviteCode", "email", "password"],
                properties: {
                    tenantInviteCode: { type: "string", example: "ORG-EXA-A1B2C3D4" },
                    email: { type: "string", format: "email", example: "new.user@example.test" },
                    password: { type: "string", format: "password", writeOnly: true, example: "Example-password-123" },
                    fullName: { type: "string", example: "New User" },
                    phone: { type: "string", example: "+1-555-0100" },
                    jobTitle: { type: "string", example: "Security Operator" },
                },
            }),
            responses: {
                "201": {
                    description: "Registration submitted for approval.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["message", "status"],
                        properties: { message: { type: "string" }, status: userStatus },
                    } } },
                },
            },
        }, { validation: true, notFound: true, conflict: true }),
    },
    "/api/auth/login": {
        post: publicOperation({
            operationId: "login",
            summary: "Log in",
            description: "Returns an access token and a separate refresh token. Only the access token belongs in Swagger's Authorize dialog.",
            tags: ["Authentication"],
            requestBody: jsonBody({
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email", example: "operator@example.test" },
                    password: { type: "string", format: "password", writeOnly: true, example: "Example-password-123" },
                },
            }),
            responses: {
                "200": {
                    description: "Authenticated.",
                    content: { "application/json": {
                        schema: authResponse,
                        example: {
                            accessToken: "eyJhbGciOiJIUzI1NiJ9.fake-access-token.signature",
                            refreshToken: "eyJhbGciOiJIUzI1NiJ9.fake-refresh-token.signature",
                            user: {
                                id: "00000000-0000-4000-8000-000000000001",
                                email: "operator@example.test",
                                fullName: "Alex Operator",
                                tenantId: "00000000-0000-4000-8000-000000000010",
                                roleId: 4,
                                roleName: "SECURITY_OPERATOR",
                                status: "APPROVED",
                                allowedPages: { alerts: ["read"], on_call: ["read"] },
                            },
                        },
                    } },
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
            },
        }, { validation: true }),
    },
    "/api/auth/refresh": {
        post: publicOperation({
            operationId: "refreshAccessToken",
            summary: "Refresh an access token",
            description: "Accepts a refresh token in JSON. The refresh token is not a bearer access token.",
            tags: ["Authentication"],
            requestBody: jsonBody(refreshBody),
            responses: {
                "200": {
                    description: "Access token refreshed.",
                    content: { "application/json": { schema: authResponse } },
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
            },
        }),
    },
    "/api/auth/logout": {
        post: publicOperation({
            operationId: "logout",
            summary: "Revoke a refresh-token session",
            tags: ["Authentication"],
            requestBody: jsonBody(refreshBody),
            responses: {
                "200": {
                    description: "Logged out.",
                    content: { "application/json": { schema: ref("SuccessResponse"), example: { message: "Logged out successfully" } } },
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
            },
        }),
    },
    "/api/auth/me": {
        get: secured({
            operationId: "getAuthenticatedUser",
            summary: "Get the authenticated user",
            tags: ["Authentication"],
            responses: {
                "200": {
                    description: "Current user.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["user"],
                        properties: { user: ref("AuthenticatedUser") },
                    } } },
                },
            },
        }, { notFound: true }),
    },
    "/api/auth/admin/registration-requests": {
        get: secured({
            operationId: "listRegistrationRequests",
            summary: "List pending registration requests",
            tags: ["Authentication"],
            responses: {
                "200": {
                    description: "Registration requests.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["registrationRequests"],
                        properties: { registrationRequests: { type: "array", items: ref("AuthenticatedUser") } },
                    } } },
                },
            },
        }),
    },
    "/api/auth/admin/registration-requests/{userId}/approve": {
        post: secured({
            operationId: "approveRegistrationRequest",
            summary: "Approve a registration request",
            tags: ["Authentication"],
            parameters: [{ ...idParameter("User UUID"), name: "userId" }],
            responses: {
                "200": {
                    description: "Approved user.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["user"],
                        properties: { user: ref("AuthenticatedUser") },
                    } } },
                },
            },
        }, { validation: true, notFound: true }),
    },
    "/api/auth/admin/registration-requests/{userId}/reject": {
        post: secured({
            operationId: "rejectRegistrationRequest",
            summary: "Reject a registration request",
            tags: ["Authentication"],
            parameters: [{ ...idParameter("User UUID"), name: "userId" }],
            requestBody: jsonBody({
                type: "object",
                properties: { rejectionReason: { type: "string", nullable: true } },
            }, false),
            responses: {
                "200": {
                    description: "Rejected user.",
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["user"],
                        properties: { user: ref("AuthenticatedUser") },
                    } } },
                },
            },
        }, { validation: true, notFound: true }),
    },
};

