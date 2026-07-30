import swaggerJsdoc from "swagger-jsdoc";
import SwaggerParser from "@apidevtools/swagger-parser";
import { commonParameters, commonResponses, commonSchemas } from "./schemas/common";
import { operationSchemas } from "./schemas/operations";
import { administrationPaths } from "./paths/administration";
import { authenticationPaths } from "./paths/authentication";
import { facePaths } from "./paths/faces";
import { healthPaths } from "./paths/health";
import { notificationPaths } from "./paths/notifications";
import { onCallPaths } from "./paths/onCall";
import { operationsPaths } from "./paths/operations";
import { organizationPaths } from "./paths/organization";
import { robotPaths } from "./paths/robots";
import type { OpenApiObject } from "./types";

// CommonJS require keeps package.json as the single source of truth without
// requiring resolveJsonModule in the backend TypeScript configuration.
const backendPackage = require("../../package.json") as { version?: string };

const deployedServerUrl = process.env.API_PUBLIC_URL?.trim() || "/";

const definition: OpenApiObject = {
    openapi: "3.0.3",
    info: {
        title: "SentryX API",
        version: backendPackage.version || "0.0.0",
        description:
            "Backend API for SentryX administration, organization management, robot events, operational alerts, notifications, and shift-duty workflows.",
    },
    servers: [
        {
            url: "http://localhost:4000",
            description: "Local development",
        },
        {
            url: deployedServerUrl,
            description: process.env.API_PUBLIC_URL
                ? "Deployed environment"
                : "Deployed environment (current origin; set API_PUBLIC_URL to publish an explicit URL)",
        },
    ],
    tags: [
        { name: "Health" },
        { name: "Authentication" },
        { name: "Tenants" },
        { name: "Licenses" },
        { name: "Roles" },
        { name: "Organization" },
        { name: "Security Shifts" },
        { name: "Visitors" },
        { name: "Events" },
        { name: "Alerts" },
        {
            name: "OnCall / Shift Duty",
            description: "An OnCall task is an existing Alert assigned to a Security Operator, not a separate Task entity.",
        },
        { name: "Notifications" },
        { name: "Robots" },
        { name: "Faces" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Paste the JWT access token returned by login. Do not use the refresh token.",
            },
        },
        schemas: {
            ...commonSchemas,
            ...operationSchemas,
        },
        parameters: commonParameters,
        responses: commonResponses,
    },
    paths: {
        ...healthPaths,
        ...authenticationPaths,
        ...administrationPaths,
        ...organizationPaths,
        ...operationsPaths,
        ...onCallPaths,
        ...notificationPaths,
        ...robotPaths,
        ...facePaths,
    },
};

const options: swaggerJsdoc.OAS3Options = {
    definition: definition as swaggerJsdoc.OAS3Definition,
    apis: [],
    failOnErrors: true,
};

export const openApiSpecification = swaggerJsdoc(options) as OpenApiObject;

function verifyGeneratedSpecification(specification: OpenApiObject): void {
    if (
        typeof specification.openapi !== "string" ||
        !specification.openapi.startsWith("3.")
    ) {
        throw new Error("OpenAPI generation failed: an OpenAPI 3.x version is required");
    }

    if (
        !specification.paths ||
        typeof specification.paths !== "object" ||
        Object.keys(specification.paths).length === 0
    ) {
        throw new Error("OpenAPI generation failed: no documented paths were generated");
    }

    const bearerAuth = specification.components?.securitySchemes?.bearerAuth;
    if (bearerAuth?.type !== "http" || bearerAuth?.scheme !== "bearer") {
        throw new Error("OpenAPI generation failed: bearerAuth is missing or invalid");
    }
}

verifyGeneratedSpecification(openApiSpecification);

export async function validateOpenApiSpecification(): Promise<void> {
    try {
        // The parser resolves local references in-place, so validate a clone and
        // preserve reusable $ref entries in the document served to consumers.
        const validationCopy = JSON.parse(JSON.stringify(openApiSpecification));
        await SwaggerParser.validate(validationCopy as any);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`OpenAPI validation failed: ${message}`);
    }
}
