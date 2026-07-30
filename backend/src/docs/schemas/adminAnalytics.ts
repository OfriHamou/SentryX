import type { OpenApiObject } from "../types";

const count = { type: "integer", minimum: 0 };
const percentage = {
    type: "number",
    format: "float",
    minimum: 0,
    maximum: 100,
    nullable: true,
    description: "Percentage rounded to one decimal place. Null when its denominator is zero.",
};
const duration = {
    type: "number",
    format: "float",
    minimum: 0,
    nullable: true,
    description: "Minutes rounded to one decimal place. Null when no valid timestamps exist.",
};

export const adminAnalyticsSchemas: Record<string, OpenApiObject> = {
    AdminAnalyticsResponse: {
        type: "object",
        required: [
            "ok", "generatedAt", "filters", "totals", "metrics", "eventBreakdown",
            "alertBreakdown", "robotStatusBreakdown", "dailyTrend", "topRobots", "organizations",
        ],
        properties: {
            ok: { type: "boolean", example: true },
            generatedAt: { type: "string", format: "date-time" },
            filters: {
                type: "object",
                required: ["tenantId", "from", "to"],
                properties: {
                    tenantId: { type: "string", format: "uuid", nullable: true },
                    from: { type: "string", format: "date-time", nullable: true },
                    to: { type: "string", format: "date-time", nullable: true },
                },
            },
            totals: {
                type: "object",
                additionalProperties: false,
                required: [
                    "totalEvents", "totalAlerts", "faceRecognitionAttempts", "recognizedFaces",
                    "unknownFaces", "smokeEvents", "fireEvents", "motionEvents", "openAlerts",
                    "inProgressAlerts", "resolvedAlerts", "activeRobots", "onlineRobots",
                    "offlineRobots", "otherStatusRobots", "reportingRobots", "robotsWithoutEvents",
                    "robotsReportingSmoke", "robotsWithoutSmokeReports", "robotsReportingFire",
                    "robotsWithoutFireReports",
                ],
                properties: Object.fromEntries([
                    "totalEvents", "totalAlerts", "faceRecognitionAttempts", "recognizedFaces",
                    "unknownFaces", "smokeEvents", "fireEvents", "motionEvents", "openAlerts",
                    "inProgressAlerts", "resolvedAlerts", "activeRobots", "onlineRobots",
                    "offlineRobots", "otherStatusRobots", "reportingRobots", "robotsWithoutEvents",
                    "robotsReportingSmoke", "robotsWithoutSmokeReports", "robotsReportingFire",
                    "robotsWithoutFireReports",
                ].map((name) => [name, count])),
            },
            metrics: {
                type: "object",
                additionalProperties: false,
                required: [
                    "faceRecognitionSuccessRate", "unknownFaceRate", "alertResolutionRate",
                    "unresolvedAlertRate", "robotOnlineRate", "robotOfflineRate",
                    "robotReportingRate", "noEventsReportedRate", "smokeReportingCoverage",
                    "fireReportingCoverage", "smokeEventShare", "fireEventShare",
                    "averageResponseMinutes", "averageResolutionMinutes",
                ],
                properties: {
                    faceRecognitionSuccessRate: {
                        ...percentage,
                        description: "Recognized face Events divided by recognized plus unknown face Events.",
                    },
                    unknownFaceRate: percentage,
                    alertResolutionRate: percentage,
                    unresolvedAlertRate: percentage,
                    robotOnlineRate: percentage,
                    robotOfflineRate: percentage,
                    robotReportingRate: percentage,
                    noEventsReportedRate: percentage,
                    smokeReportingCoverage: {
                        ...percentage,
                        description: "Active Robots reporting smoke, not smoke detection accuracy.",
                    },
                    fireReportingCoverage: {
                        ...percentage,
                        description: "Active Robots reporting fire, not fire detection accuracy.",
                    },
                    smokeEventShare: percentage,
                    fireEventShare: percentage,
                    averageResponseMinutes: duration,
                    averageResolutionMinutes: duration,
                },
            },
            eventBreakdown: {
                type: "array",
                items: {
                    type: "object",
                    required: ["eventType", "count", "percentage"],
                    properties: {
                        eventType: {
                            type: "string",
                            enum: ["face_recognized", "face_detected_unknown", "motion", "smoke", "fire"],
                        },
                        count,
                        percentage,
                    },
                },
            },
            alertBreakdown: {
                type: "object",
                required: ["open", "inProgress", "resolved"],
                properties: { open: count, inProgress: count, resolved: count },
            },
            robotStatusBreakdown: {
                type: "object",
                required: ["online", "offline", "other"],
                properties: { online: count, offline: count, other: count },
            },
            dailyTrend: {
                type: "array",
                description: "Chronological daily or monthly buckets selected according to range length.",
                items: {
                    type: "object",
                    required: [
                        "date", "events", "recognizedFaces", "unknownFaces", "smoke",
                        "fire", "alertsCreated", "alertsResolved",
                    ],
                    properties: {
                        date: { type: "string", format: "date" },
                        events: count,
                        recognizedFaces: count,
                        unknownFaces: count,
                        smoke: count,
                        fire: count,
                        alertsCreated: count,
                        alertsResolved: count,
                    },
                },
            },
            topRobots: {
                type: "array",
                maxItems: 10,
                items: {
                    type: "object",
                    required: [
                        "robotId", "robotName", "location", "tenantId", "tenantName",
                        "totalEvents", "recognizedFaces", "unknownFaces", "smokeEvents",
                        "fireEvents", "lastEventAt",
                    ],
                    properties: {
                        robotId: { type: "string", format: "uuid" },
                        robotName: { type: "string" },
                        location: { type: "string", nullable: true },
                        tenantId: { type: "string", format: "uuid" },
                        tenantName: { type: "string" },
                        totalEvents: count,
                        recognizedFaces: count,
                        unknownFaces: count,
                        smokeEvents: count,
                        fireEvents: count,
                        lastEventAt: { type: "string", format: "date-time" },
                    },
                },
            },
            organizations: {
                type: "array",
                items: {
                    type: "object",
                    required: [
                        "tenantId", "tenantName", "totalEvents", "totalAlerts",
                        "faceRecognitionSuccessRate", "alertResolutionRate", "robotOnlineRate",
                        "robotReportingRate", "activeRobots", "onlineRobots", "reportingRobots",
                        "smokeEvents", "fireEvents", "averageResponseMinutes",
                        "averageResolutionMinutes",
                    ],
                    properties: {
                        tenantId: { type: "string", format: "uuid" },
                        tenantName: { type: "string" },
                        totalEvents: count,
                        totalAlerts: count,
                        faceRecognitionSuccessRate: percentage,
                        alertResolutionRate: percentage,
                        robotOnlineRate: percentage,
                        robotReportingRate: percentage,
                        activeRobots: count,
                        onlineRobots: count,
                        reportingRobots: count,
                        smokeEvents: count,
                        fireEvents: count,
                        averageResponseMinutes: duration,
                        averageResolutionMinutes: duration,
                    },
                },
            },
        },
    },
};
