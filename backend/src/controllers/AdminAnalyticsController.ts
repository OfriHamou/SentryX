import { Request, Response } from "express";
import {
    AdminAnalyticsService,
    type AdminAnalyticsFilters,
} from "../services/AdminAnalyticsService";
import { logger } from "../utils/logger";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function scalar(value: unknown): string | undefined {
    return typeof value === "string" ? value.trim() : undefined;
}

function timestamp(value: unknown): Date | undefined {
    const text = scalar(value);
    if (!text || !ISO_TIMESTAMP_PATTERN.test(text)) return undefined;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export class AdminAnalyticsController {
    static async get(req: Request, res: Response): Promise<void> {
        const supportedFilters = ["tenantId", "from", "to"] as const;
        if (supportedFilters.some((key) => req.query[key] !== undefined && typeof req.query[key] !== "string")) {
            res.status(400).json({ ok: false, error: "Query filters must be supplied once" });
            return;
        }

        const tenantId = scalar(req.query.tenantId);
        const from = timestamp(req.query.from);
        const to = timestamp(req.query.to);

        if (req.query.tenantId !== undefined && (!tenantId || !UUID_PATTERN.test(tenantId))) {
            res.status(400).json({ ok: false, error: "Invalid tenantId" });
            return;
        }
        if (req.query.from !== undefined && !from) {
            res.status(400).json({ ok: false, error: "Invalid from timestamp" });
            return;
        }
        if (req.query.to !== undefined && !to) {
            res.status(400).json({ ok: false, error: "Invalid to timestamp" });
            return;
        }
        if (from && to && from > to) {
            res.status(400).json({ ok: false, error: "from must not be later than to" });
            return;
        }

        const filters: AdminAnalyticsFilters = { tenantId, from, to };
        try {
            res.status(200).json(await AdminAnalyticsService.getAnalytics(filters));
        } catch (error) {
            logger.error("Admin Analytics query failed", error, {
                category: "ADMIN_ANALYTICS",
                action: "GET_ADMIN_ANALYTICS_FAILED",
                status: "FAILED",
                context: "AdminAnalyticsController.get",
            });
            res.status(500).json({ ok: false, error: "Failed to fetch Admin Analytics" });
        }
    }
}
