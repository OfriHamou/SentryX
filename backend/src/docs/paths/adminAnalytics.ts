import { ref, secured } from "../helpers";
import type { OpenApiPaths } from "../types";

export const adminAnalyticsPaths: OpenApiPaths = {
    "/api/admin/analytics": {
        get: secured({
            operationId: "getAdminAnalytics",
            summary: "Get platform-wide performance Analytics",
            description:
                "Read-only platform Admin operation requiring `admin_analytics:read`; tenant-scoped permissions do not grant access and results are not restricted to the authenticated Admin's Tenant. Face-recognition success compares `face_recognized` with `face_detected_unknown`. Smoke and fire coverage reports how many active Robots submitted those Events and is not detection accuracy. Robot availability is current state and excludes archived Robots; Event and Alert metrics use the selected creation-time period. Percentages and durations are nullable when no valid denominator or timestamps exist.",
            tags: ["Admin Analytics"],
            parameters: [
                {
                    name: "tenantId",
                    in: "query",
                    schema: { type: "string", format: "uuid" },
                    description: "Optional Tenant restriction. Omit for all Tenants.",
                },
                {
                    name: "from",
                    in: "query",
                    schema: { type: "string", format: "date-time" },
                    description: "Inclusive Event and Alert creation timestamp lower bound.",
                },
                {
                    name: "to",
                    in: "query",
                    schema: { type: "string", format: "date-time" },
                    description: "Inclusive Event and Alert creation timestamp upper bound.",
                },
            ],
            responses: {
                "200": {
                    description: "Filtered platform Analytics. Percentage values range from 0 to 100.",
                    content: {
                        "application/json": { schema: ref("AdminAnalyticsResponse") },
                    },
                },
            },
        }, { validation: true }),
    },
};
