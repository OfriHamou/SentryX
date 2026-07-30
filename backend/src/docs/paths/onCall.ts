import { parameterRef, ref, secured, tenantScopedDescription } from "../helpers";
import type { OpenApiPaths } from "../types";

export const onCallPaths: OpenApiPaths = {
    "/api/on-call/me": {
        get: secured({
            operationId: "getMyCurrentOnCallDuty",
            summary: "Get the authenticated operator's current duty",
            description: `${tenantScopedDescription} Requires the on_call:read permission. A current shift must cover the present instant and be assigned to the authenticated user. Returns isOnCall false and currentShift null when there is no current duty.`,
            tags: ["OnCall / Shift Duty"],
            responses: {
                "200": {
                    description: "Current duty state.",
                    content: {
                        "application/json": {
                            schema: ref("CurrentDutyResponse"),
                            example: {
                                ok: true,
                                isOnCall: true,
                                currentShift: {
                                    id: "00000000-0000-4000-8000-000000000051",
                                    name: "Night shift",
                                    startAt: "2026-07-29T18:00:00.000Z",
                                    endAt: "2026-07-30T06:00:00.000Z",
                                    status: "ACTIVE",
                                    notes: "Monitor lobby and loading dock",
                                },
                            },
                        },
                    },
                },
            },
        }),
    },
    "/api/on-call/tasks": {
        get: secured({
            operationId: "listMyOnCallTasks",
            summary: "List Alerts assigned to the authenticated operator",
            description: `${tenantScopedDescription} Requires the on_call:read permission. These tasks are existing Alerts assigned to the authenticated Security Operator; there is no separate Task entity. This user-specific view does not replace or filter the tenant-wide GET /api/alerts history.`,
            tags: ["OnCall / Shift Duty"],
            parameters: [
                {
                    name: "status",
                    in: "query",
                    schema: { type: "string", enum: ["all", "active", "resolved"], default: "active" },
                    description: "active includes OPEN and IN_PROGRESS Alerts.",
                },
                parameterRef("Limit"),
                parameterRef("Offset"),
            ],
            responses: {
                "200": {
                    description: "Assigned Alerts with counts and pagination.",
                    content: {
                        "application/json": {
                            schema: ref("OnCallTasksResponse"),
                            example: {
                                ok: true,
                                alerts: [{
                                    id: "00000000-0000-4000-8000-000000000021",
                                    status: "IN_PROGRESS",
                                    displayTitle: "Unknown person detected",
                                    startedAt: "2026-07-29T18:05:00.000Z",
                                    resolvedAt: null,
                                    resolutionNotes: null,
                                    createdAt: "2026-07-29T18:04:00.000Z",
                                    updatedAt: "2026-07-29T18:05:00.000Z",
                                    assignedUser: {
                                        id: "00000000-0000-4000-8000-000000000001",
                                        fullName: "Alex Operator",
                                        email: "operator@example.test",
                                        jobTitle: "Security Operator",
                                    },
                                    assignedShift: {
                                        id: "00000000-0000-4000-8000-000000000051",
                                        name: "Night shift",
                                        startAt: "2026-07-29T18:00:00.000Z",
                                        endAt: "2026-07-30T06:00:00.000Z",
                                        status: "ACTIVE",
                                    },
                                    resolvedBy: null,
                                    event: null,
                                }],
                                counts: { all: 1, active: 1, resolved: 0 },
                                pagination: { limit: 50, offset: 0, total: 1 },
                            },
                        },
                    },
                },
            },
        }, { validation: true }),
    },
};
