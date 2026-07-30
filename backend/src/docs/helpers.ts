import type { OpenApiObject } from "./types";

export const ref = (name: string): OpenApiObject => ({ $ref: `#/components/schemas/${name}` });
export const responseRef = (name: string): OpenApiObject => ({ $ref: `#/components/responses/${name}` });
export const parameterRef = (name: string): OpenApiObject => ({ $ref: `#/components/parameters/${name}` });

export const jsonContent = (schema: OpenApiObject, example?: unknown): OpenApiObject => ({
    content: {
        "application/json": {
            schema,
            ...(example === undefined ? {} : { example }),
        },
    },
});

export const jsonBody = (schema: OpenApiObject, required = true, example?: unknown): OpenApiObject => ({
    required,
    ...jsonContent(schema, example),
});

export const secured = (
    operation: OpenApiObject,
    options: { validation?: boolean; notFound?: boolean; conflict?: boolean } = {},
): OpenApiObject => ({
    ...operation,
    security: [{ bearerAuth: [] }],
    responses: {
        ...operation.responses,
        ...(options.validation ? { "400": responseRef("ValidationError") } : {}),
        "401": responseRef("Unauthorized"),
        "403": responseRef("Forbidden"),
        ...(options.notFound ? { "404": responseRef("NotFound") } : {}),
        ...(options.conflict ? { "409": responseRef("Conflict") } : {}),
        "500": responseRef("ServerError"),
    },
});

export const publicOperation = (
    operation: OpenApiObject,
    options: { validation?: boolean; notFound?: boolean; conflict?: boolean } = {},
): OpenApiObject => ({
    ...operation,
    security: [],
    responses: {
        ...operation.responses,
        ...(options.validation ? { "400": responseRef("ValidationError") } : {}),
        ...(options.notFound ? { "404": responseRef("NotFound") } : {}),
        ...(options.conflict ? { "409": responseRef("Conflict") } : {}),
        "500": responseRef("ServerError"),
    },
});

export const idParameter = (description = "Resource UUID"): OpenApiObject => ({
    name: "id",
    in: "path",
    required: true,
    description,
    schema: { type: "string", format: "uuid" },
});

export const tenantScopedDescription =
    "Results are restricted to the authenticated user's tenant. A resource outside that tenant is treated as unavailable.";

