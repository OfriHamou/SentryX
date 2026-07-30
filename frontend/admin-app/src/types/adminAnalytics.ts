export type AnalyticsEventType =
    | 'face_recognized'
    | 'face_detected_unknown'
    | 'motion'
    | 'smoke'
    | 'fire';

export interface AdminAnalyticsQueryParams {
    tenantId?: string;
    from?: string;
    to?: string;
}

export interface AnalyticsTenantOption {
    id: string;
    name: string;
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
    alertBreakdown: {
        open: number;
        inProgress: number;
        resolved: number;
    };
    robotStatusBreakdown: {
        online: number;
        offline: number;
        other: number;
    };
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
