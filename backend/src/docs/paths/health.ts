import { publicOperation } from "../helpers";
import type { OpenApiPaths } from "../types";

export const healthPaths: OpenApiPaths = {
    "/api/health": {
        get: publicOperation({
            operationId: "getHealth",
            summary: "Check backend health",
            tags: ["Health"],
            responses: {
                "200": {
                    description: "Backend is running.",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["status"],
                                properties: { status: { type: "string", enum: ["OK"] } },
                            },
                            example: { status: "OK" },
                        },
                    },
                },
            },
        }),
    },
};

