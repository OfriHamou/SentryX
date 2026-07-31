import { AppDataSource } from "../db";

export const ANALYTICS_EVENT_TYPES = [
    "face_recognized",
    "face_detected_unknown",
    "motion",
    "smoke",
    "fire",
] as const;

export type AnalyticsEventType = typeof ANALYTICS_EVENT_TYPES[number];

export interface AdminAnalyticsFilters {
    tenantId?: string;
    from?: Date;
    to?: Date;
}

export interface AdminAnalyticsResponse {
    ok: true;
    generatedAt: string;
    filters: {
        tenantId: string | null;
        from: string | null;
        to: string | null;
    };
    totals: {
        totalEvents: number;
        totalAlerts: number;
        faceRecognitionAttempts: number;
        recognizedFaces: number;
        unknownFaces: number;
        smokeEvents: number;
        fireEvents: number;
        motionEvents: number;
        openAlerts: number;
        inProgressAlerts: number;
        resolvedAlerts: number;
        activeRobots: number;
        onlineRobots: number;
        offlineRobots: number;
        otherStatusRobots: number;
        reportingRobots: number;
        robotsWithoutEvents: number;
        robotsReportingSmoke: number;
        robotsWithoutSmokeReports: number;
        robotsReportingFire: number;
        robotsWithoutFireReports: number;
    };
    metrics: {
        faceRecognitionSuccessRate: number | null;
        unknownFaceRate: number | null;
        alertResolutionRate: number | null;
        unresolvedAlertRate: number | null;
        robotOnlineRate: number | null;
        robotOfflineRate: number | null;
        robotReportingRate: number | null;
        noEventsReportedRate: number | null;
        smokeReportingCoverage: number | null;
        fireReportingCoverage: number | null;
        smokeEventShare: number | null;
        fireEventShare: number | null;
        averageResponseMinutes: number | null;
        averageResolutionMinutes: number | null;
    };
    eventBreakdown: Array<{
        eventType: AnalyticsEventType;
        count: number;
        percentage: number | null;
    }>;
    alertBreakdown: { open: number; inProgress: number; resolved: number };
    robotStatusBreakdown: { online: number; offline: number; other: number };
    dailyTrend: Array<{
        date: string;
        events: number;
        recognizedFaces: number;
        unknownFaces: number;
        smoke: number;
        fire: number;
        alertsCreated: number;
        alertsResolved: number;
    }>;
    topRobots: Array<{
        robotId: string;
        robotName: string;
        location: string | null;
        tenantId: string;
        tenantName: string;
        totalEvents: number;
        recognizedFaces: number;
        unknownFaces: number;
        smokeEvents: number;
        fireEvents: number;
        lastEventAt: string;
    }>;
    organizations: Array<{
        tenantId: string;
        tenantName: string;
        totalEvents: number;
        totalAlerts: number;
        faceRecognitionSuccessRate: number | null;
        alertResolutionRate: number | null;
        robotOnlineRate: number | null;
        robotReportingRate: number | null;
        activeRobots: number;
        onlineRobots: number;
        reportingRobots: number;
        smokeEvents: number;
        fireEvents: number;
        averageResponseMinutes: number | null;
        averageResolutionMinutes: number | null;
    }>;
}

export interface QueryExecutor {
    query<T = unknown>(query: string, parameters?: unknown[]): Promise<T>;
}

type RawRow = Record<string, unknown>;

const EVENT_FILTER = `
    ($1::uuid IS NULL OR e.tenant_id = $1::uuid)
    AND ($2::timestamptz IS NULL OR e.created_at >= $2::timestamptz)
    AND ($3::timestamptz IS NULL OR e.created_at <= $3::timestamptz)
    AND e.event_type = ANY($4::text[])
`;

const ALERT_FILTER = `
    ($1::uuid IS NULL OR a.tenant_id = $1::uuid)
    AND ($2::timestamptz IS NULL OR a.created_at >= $2::timestamptz)
    AND ($3::timestamptz IS NULL OR a.created_at <= $3::timestamptz)
`;

function numberValue(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function roundedMetric(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}

export function percentage(numerator: number, denominator: number): number | null {
    if (denominator <= 0) return null;
    return roundedMetric((numerator / denominator) * 100);
}

function isoValue(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function trendBucket(filters: AdminAnalyticsFilters): "day" | "month" {
    if (!filters.from || !filters.to) return "month";
    const days = (filters.to.getTime() - filters.from.getTime()) / 86_400_000;
    return days > 93 ? "month" : "day";
}

function trendDate(value: unknown): string {
    return isoValue(value).slice(0, 10);
}

export class AdminAnalyticsService {
    static async getAnalytics(
        filters: AdminAnalyticsFilters,
        executor: QueryExecutor = AppDataSource.manager,
    ): Promise<AdminAnalyticsResponse> {
        const parameters = [
            filters.tenantId ?? null,
            filters.from?.toISOString() ?? null,
            filters.to?.toISOString() ?? null,
            [...ANALYTICS_EVENT_TYPES],
        ];
        const bucket = trendBucket(filters);

        const [
            eventRows,
            alertRows,
            robotRows,
            eventBreakdownRows,
            eventTrendRows,
            alertTrendRows,
            topRobotRows,
            organizationRows,
        ] = await Promise.all([
            executor.query<RawRow[]>(`
                /* analytics:event-totals */
                SELECT
                    COUNT(*) AS "totalEvents",
                    COUNT(*) FILTER (WHERE e.event_type = 'face_recognized') AS "recognizedFaces",
                    COUNT(*) FILTER (WHERE e.event_type = 'face_detected_unknown') AS "unknownFaces",
                    COUNT(*) FILTER (WHERE e.event_type = 'motion') AS "motionEvents",
                    COUNT(*) FILTER (WHERE e.event_type = 'smoke') AS "smokeEvents",
                    COUNT(*) FILTER (WHERE e.event_type = 'fire') AS "fireEvents"
                FROM events e
                WHERE ${EVENT_FILTER}
            `, parameters),
            executor.query<RawRow[]>(`
                /* analytics:alert-totals */
                SELECT
                    COUNT(*) AS "totalAlerts",
                    COUNT(*) FILTER (WHERE a.status = 'OPEN') AS "openAlerts",
                    COUNT(*) FILTER (WHERE a.status = 'IN_PROGRESS') AS "inProgressAlerts",
                    COUNT(*) FILTER (WHERE a.status = 'RESOLVED') AS "resolvedAlerts",
                    AVG(EXTRACT(EPOCH FROM (a.started_at - a.created_at)) / 60.0)
                        FILTER (WHERE a.started_at IS NOT NULL AND a.started_at >= a.created_at)
                        AS "averageResponseMinutes",
                    AVG(EXTRACT(EPOCH FROM (a.resolved_at - a.created_at)) / 60.0)
                        FILTER (
                            WHERE a.status = 'RESOLVED'
                            AND a.resolved_at IS NOT NULL
                            AND a.resolved_at >= a.created_at
                        ) AS "averageResolutionMinutes"
                FROM alerts a
                WHERE ${ALERT_FILTER}
            `, parameters.slice(0, 3)),
            executor.query<RawRow[]>(`
                /* analytics:robot-totals */
                SELECT
                    COUNT(DISTINCT r.id) AS "activeRobots",
                    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'Online') AS "onlineRobots",
                    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'Offline') AS "offlineRobots",
                    COUNT(DISTINCT r.id) FILTER (
                        WHERE r.status NOT IN ('Online', 'Offline') OR r.status IS NULL
                    ) AS "otherStatusRobots",
                    COUNT(DISTINCT r.id) FILTER (WHERE reported.robot_id IS NOT NULL) AS "reportingRobots",
                    COUNT(DISTINCT r.id) FILTER (WHERE smoke.robot_id IS NOT NULL) AS "robotsReportingSmoke",
                    COUNT(DISTINCT r.id) FILTER (WHERE fire.robot_id IS NOT NULL) AS "robotsReportingFire"
                FROM robots r
                LEFT JOIN (
                    SELECT DISTINCT e.robot_id
                    FROM events e
                    WHERE ($2::timestamptz IS NULL OR e.created_at >= $2::timestamptz)
                        AND ($3::timestamptz IS NULL OR e.created_at <= $3::timestamptz)
                        AND e.event_type = ANY($4::text[])
                ) reported ON reported.robot_id = r.id
                LEFT JOIN (
                    SELECT DISTINCT e.robot_id
                    FROM events e
                    WHERE e.event_type = 'smoke'
                        AND ($2::timestamptz IS NULL OR e.created_at >= $2::timestamptz)
                        AND ($3::timestamptz IS NULL OR e.created_at <= $3::timestamptz)
                ) smoke ON smoke.robot_id = r.id
                LEFT JOIN (
                    SELECT DISTINCT e.robot_id
                    FROM events e
                    WHERE e.event_type = 'fire'
                        AND ($2::timestamptz IS NULL OR e.created_at >= $2::timestamptz)
                        AND ($3::timestamptz IS NULL OR e.created_at <= $3::timestamptz)
                ) fire ON fire.robot_id = r.id
                WHERE r.archived_at IS NULL
                    AND ($1::uuid IS NULL OR r.tenant_id = $1::uuid)
            `, parameters),
            executor.query<RawRow[]>(`
                /* analytics:event-breakdown */
                SELECT e.event_type AS "eventType", COUNT(*) AS count
                FROM events e
                WHERE ${EVENT_FILTER}
                GROUP BY e.event_type
            `, parameters),
            executor.query<RawRow[]>(`
                /* analytics:event-trend */
                SELECT
                    date_trunc('${bucket}', e.created_at) AS bucket,
                    COUNT(*) AS events,
                    COUNT(*) FILTER (WHERE e.event_type = 'face_recognized') AS "recognizedFaces",
                    COUNT(*) FILTER (WHERE e.event_type = 'face_detected_unknown') AS "unknownFaces",
                    COUNT(*) FILTER (WHERE e.event_type = 'smoke') AS smoke,
                    COUNT(*) FILTER (WHERE e.event_type = 'fire') AS fire
                FROM events e
                WHERE ${EVENT_FILTER}
                GROUP BY bucket
                ORDER BY bucket
            `, parameters),
            executor.query<RawRow[]>(`
                /* analytics:alert-trend */
                SELECT
                    date_trunc('${bucket}', a.created_at) AS bucket,
                    COUNT(*) AS "alertsCreated",
                    COUNT(*) FILTER (WHERE a.status = 'RESOLVED') AS "alertsResolved"
                FROM alerts a
                WHERE ${ALERT_FILTER}
                GROUP BY bucket
                ORDER BY bucket
            `, parameters.slice(0, 3)),
            executor.query<RawRow[]>(`
                /* analytics:top-robots */
                SELECT
                    r.id AS "robotId",
                    r.name AS "robotName",
                    r.location,
                    t.id AS "tenantId",
                    t.name AS "tenantName",
                    COUNT(*) AS "totalEvents",
                    COUNT(*) FILTER (WHERE e.event_type = 'face_recognized') AS "recognizedFaces",
                    COUNT(*) FILTER (WHERE e.event_type = 'face_detected_unknown') AS "unknownFaces",
                    COUNT(*) FILTER (WHERE e.event_type = 'smoke') AS "smokeEvents",
                    COUNT(*) FILTER (WHERE e.event_type = 'fire') AS "fireEvents",
                    MAX(e.created_at) AS "lastEventAt"
                FROM events e
                INNER JOIN robots r ON r.id = e.robot_id AND r.archived_at IS NULL
                INNER JOIN tenants t ON t.id = r.tenant_id
                WHERE ${EVENT_FILTER}
                GROUP BY r.id, r.name, r.location, t.id, t.name
                ORDER BY "totalEvents" DESC, r.name ASC
                LIMIT 10
            `, parameters),
            executor.query<RawRow[]>(`
                /* analytics:organizations */
                WITH matching_tenants AS (
                    SELECT t.id, t.name
                    FROM tenants t
                    WHERE $1::uuid IS NULL OR t.id = $1::uuid
                ),
                event_stats AS (
                    SELECT
                        e.tenant_id,
                        COUNT(*) AS total_events,
                        COUNT(*) FILTER (WHERE e.event_type = 'face_recognized') AS recognized_faces,
                        COUNT(*) FILTER (WHERE e.event_type = 'face_detected_unknown') AS unknown_faces,
                        COUNT(*) FILTER (WHERE e.event_type = 'smoke') AS smoke_events,
                        COUNT(*) FILTER (WHERE e.event_type = 'fire') AS fire_events
                    FROM events e
                    WHERE ${EVENT_FILTER}
                    GROUP BY e.tenant_id
                ),
                alert_stats AS (
                    SELECT
                        a.tenant_id,
                        COUNT(*) AS total_alerts,
                        COUNT(*) FILTER (WHERE a.status = 'RESOLVED') AS resolved_alerts,
                        AVG(EXTRACT(EPOCH FROM (a.started_at - a.created_at)) / 60.0)
                            FILTER (WHERE a.started_at IS NOT NULL AND a.started_at >= a.created_at)
                            AS average_response_minutes,
                        AVG(EXTRACT(EPOCH FROM (a.resolved_at - a.created_at)) / 60.0)
                            FILTER (
                                WHERE a.status = 'RESOLVED'
                                AND a.resolved_at IS NOT NULL
                                AND a.resolved_at >= a.created_at
                            ) AS average_resolution_minutes
                    FROM alerts a
                    WHERE ${ALERT_FILTER}
                    GROUP BY a.tenant_id
                ),
                robot_stats AS (
                    SELECT
                        r.tenant_id,
                        COUNT(DISTINCT r.id) AS active_robots,
                        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'Online') AS online_robots,
                        COUNT(DISTINCT r.id) FILTER (WHERE reported.robot_id IS NOT NULL) AS reporting_robots
                    FROM robots r
                    LEFT JOIN (
                        SELECT DISTINCT e.robot_id
                        FROM events e
                        WHERE ($2::timestamptz IS NULL OR e.created_at >= $2::timestamptz)
                            AND ($3::timestamptz IS NULL OR e.created_at <= $3::timestamptz)
                            AND e.event_type = ANY($4::text[])
                    ) reported ON reported.robot_id = r.id
                    WHERE r.archived_at IS NULL
                        AND ($1::uuid IS NULL OR r.tenant_id = $1::uuid)
                    GROUP BY r.tenant_id
                )
                SELECT
                    mt.id AS "tenantId",
                    mt.name AS "tenantName",
                    COALESCE(es.total_events, 0) AS "totalEvents",
                    COALESCE(es.recognized_faces, 0) AS "recognizedFaces",
                    COALESCE(es.unknown_faces, 0) AS "unknownFaces",
                    COALESCE(es.smoke_events, 0) AS "smokeEvents",
                    COALESCE(es.fire_events, 0) AS "fireEvents",
                    COALESCE(als.total_alerts, 0) AS "totalAlerts",
                    COALESCE(als.resolved_alerts, 0) AS "resolvedAlerts",
                    als.average_response_minutes AS "averageResponseMinutes",
                    als.average_resolution_minutes AS "averageResolutionMinutes",
                    COALESCE(rs.active_robots, 0) AS "activeRobots",
                    COALESCE(rs.online_robots, 0) AS "onlineRobots",
                    COALESCE(rs.reporting_robots, 0) AS "reportingRobots"
                FROM matching_tenants mt
                LEFT JOIN event_stats es ON es.tenant_id = mt.id
                LEFT JOIN alert_stats als ON als.tenant_id = mt.id
                LEFT JOIN robot_stats rs ON rs.tenant_id = mt.id
                ORDER BY "totalEvents" DESC, mt.name ASC
            `, parameters),
        ]);

        const eventTotals = eventRows[0] ?? {};
        const alertTotals = alertRows[0] ?? {};
        const robotTotals = robotRows[0] ?? {};
        const recognizedFaces = numberValue(eventTotals.recognizedFaces);
        const unknownFaces = numberValue(eventTotals.unknownFaces);
        const faceRecognitionAttempts = recognizedFaces + unknownFaces;
        const smokeEvents = numberValue(eventTotals.smokeEvents);
        const fireEvents = numberValue(eventTotals.fireEvents);
        const safetyEvents = smokeEvents + fireEvents;
        const totalAlerts = numberValue(alertTotals.totalAlerts);
        const openAlerts = numberValue(alertTotals.openAlerts);
        const inProgressAlerts = numberValue(alertTotals.inProgressAlerts);
        const resolvedAlerts = numberValue(alertTotals.resolvedAlerts);
        const activeRobots = numberValue(robotTotals.activeRobots);
        const onlineRobots = numberValue(robotTotals.onlineRobots);
        const offlineRobots = numberValue(robotTotals.offlineRobots);
        const reportingRobots = numberValue(robotTotals.reportingRobots);
        const robotsReportingSmoke = numberValue(robotTotals.robotsReportingSmoke);
        const robotsReportingFire = numberValue(robotTotals.robotsReportingFire);
        const totalEvents = numberValue(eventTotals.totalEvents);
        const breakdownCounts = new Map(
            eventBreakdownRows.map((row) => [String(row.eventType), numberValue(row.count)]),
        );

        const trends = new Map<string, AdminAnalyticsResponse["dailyTrend"][number]>();
        for (const row of eventTrendRows) {
            const date = trendDate(row.bucket);
            trends.set(date, {
                date,
                events: numberValue(row.events),
                recognizedFaces: numberValue(row.recognizedFaces),
                unknownFaces: numberValue(row.unknownFaces),
                smoke: numberValue(row.smoke),
                fire: numberValue(row.fire),
                alertsCreated: 0,
                alertsResolved: 0,
            });
        }
        for (const row of alertTrendRows) {
            const date = trendDate(row.bucket);
            const existing = trends.get(date) ?? {
                date,
                events: 0,
                recognizedFaces: 0,
                unknownFaces: 0,
                smoke: 0,
                fire: 0,
                alertsCreated: 0,
                alertsResolved: 0,
            };
            existing.alertsCreated = numberValue(row.alertsCreated);
            existing.alertsResolved = numberValue(row.alertsResolved);
            trends.set(date, existing);
        }

        return {
            ok: true,
            generatedAt: new Date().toISOString(),
            filters: {
                tenantId: filters.tenantId ?? null,
                from: filters.from?.toISOString() ?? null,
                to: filters.to?.toISOString() ?? null,
            },
            totals: {
                totalEvents,
                totalAlerts,
                faceRecognitionAttempts,
                recognizedFaces,
                unknownFaces,
                smokeEvents,
                fireEvents,
                motionEvents: numberValue(eventTotals.motionEvents),
                openAlerts,
                inProgressAlerts,
                resolvedAlerts,
                activeRobots,
                onlineRobots,
                offlineRobots,
                otherStatusRobots: numberValue(robotTotals.otherStatusRobots),
                reportingRobots,
                robotsWithoutEvents: Math.max(0, activeRobots - reportingRobots),
                robotsReportingSmoke,
                robotsWithoutSmokeReports: Math.max(0, activeRobots - robotsReportingSmoke),
                robotsReportingFire,
                robotsWithoutFireReports: Math.max(0, activeRobots - robotsReportingFire),
            },
            metrics: {
                faceRecognitionSuccessRate: percentage(recognizedFaces, faceRecognitionAttempts),
                unknownFaceRate: percentage(unknownFaces, faceRecognitionAttempts),
                alertResolutionRate: percentage(resolvedAlerts, totalAlerts),
                unresolvedAlertRate: percentage(openAlerts + inProgressAlerts, totalAlerts),
                robotOnlineRate: percentage(onlineRobots, activeRobots),
                robotOfflineRate: percentage(offlineRobots, activeRobots),
                robotReportingRate: percentage(reportingRobots, activeRobots),
                noEventsReportedRate: percentage(activeRobots - reportingRobots, activeRobots),
                smokeReportingCoverage: percentage(robotsReportingSmoke, activeRobots),
                fireReportingCoverage: percentage(robotsReportingFire, activeRobots),
                smokeEventShare: percentage(smokeEvents, safetyEvents),
                fireEventShare: percentage(fireEvents, safetyEvents),
                averageResponseMinutes: roundedMetric(alertTotals.averageResponseMinutes),
                averageResolutionMinutes: roundedMetric(alertTotals.averageResolutionMinutes),
            },
            eventBreakdown: ANALYTICS_EVENT_TYPES.map((eventType) => {
                const count = breakdownCounts.get(eventType) ?? 0;
                return { eventType, count, percentage: percentage(count, totalEvents) };
            }),
            alertBreakdown: { open: openAlerts, inProgress: inProgressAlerts, resolved: resolvedAlerts },
            robotStatusBreakdown: {
                online: onlineRobots,
                offline: offlineRobots,
                other: numberValue(robotTotals.otherStatusRobots),
            },
            dailyTrend: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date)),
            topRobots: topRobotRows.slice(0, 10).map((row) => ({
                robotId: String(row.robotId),
                robotName: String(row.robotName),
                location: row.location === null || row.location === undefined ? null : String(row.location),
                tenantId: String(row.tenantId),
                tenantName: String(row.tenantName),
                totalEvents: numberValue(row.totalEvents),
                recognizedFaces: numberValue(row.recognizedFaces),
                unknownFaces: numberValue(row.unknownFaces),
                smokeEvents: numberValue(row.smokeEvents),
                fireEvents: numberValue(row.fireEvents),
                lastEventAt: isoValue(row.lastEventAt),
            })),
            organizations: organizationRows.map((row) => {
                const organizationRecognized = numberValue(row.recognizedFaces);
                const organizationUnknown = numberValue(row.unknownFaces);
                const organizationAlerts = numberValue(row.totalAlerts);
                const organizationResolved = numberValue(row.resolvedAlerts);
                const organizationRobots = numberValue(row.activeRobots);
                const organizationOnline = numberValue(row.onlineRobots);
                const organizationReporting = numberValue(row.reportingRobots);
                return {
                    tenantId: String(row.tenantId),
                    tenantName: String(row.tenantName),
                    totalEvents: numberValue(row.totalEvents),
                    totalAlerts: organizationAlerts,
                    faceRecognitionSuccessRate: percentage(
                        organizationRecognized,
                        organizationRecognized + organizationUnknown,
                    ),
                    alertResolutionRate: percentage(organizationResolved, organizationAlerts),
                    robotOnlineRate: percentage(organizationOnline, organizationRobots),
                    robotReportingRate: percentage(organizationReporting, organizationRobots),
                    activeRobots: organizationRobots,
                    onlineRobots: organizationOnline,
                    reportingRobots: organizationReporting,
                    smokeEvents: numberValue(row.smokeEvents),
                    fireEvents: numberValue(row.fireEvents),
                    averageResponseMinutes: roundedMetric(row.averageResponseMinutes),
                    averageResolutionMinutes: roundedMetric(row.averageResolutionMinutes),
                };
            }),
        };
    }
}
