import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/services/token";
import { logger } from "../utils/logger";

function getRequestId(req: Request): string | undefined {
    const header = req.headers["x-request-id"];
    if (typeof header === "string" && header.trim().length > 0) {
        return header.trim();
    }

    if (Array.isArray(header) && typeof header[0] === "string" && header[0].trim().length > 0) {
        return header[0].trim();
    }

    return undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        logger.warn("Unauthorized access", {
            category: "SECURITY",
            action: "UNAUTHORIZED_MISSING_HEADER",
            status: "FAILED",
            context: "AuthMiddleware",
            requestId: getRequestId(req),
            metadata: {
                method: req.method,
                route: req.originalUrl,
                reason: "MISSING_OR_INVALID_AUTH_HEADER"
            }
        });
        res.status(401).json({ message: "Missing or invalid authorization header" });
        return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
        logger.warn("Unauthorized access", {
            category: "SECURITY",
            action: "UNAUTHORIZED_MISSING_HEADER",
            status: "FAILED",
            context: "AuthMiddleware",
            requestId: getRequestId(req),
            metadata: {
                method: req.method,
                route: req.originalUrl,
                reason: "EMPTY_BEARER_TOKEN"
            }
        });
        res.status(401).json({ message: "Missing authentication token" });
        return;
    }

    try {
        res.locals.auth = verifyAccessToken(token);
        next();
    } catch (error) {
        logger.warn("Token validation failed", {
            category: "SECURITY",
            action: "TOKEN_VALIDATION_FAILED",
            status: "FAILED",
            context: "AuthMiddleware",
            requestId: getRequestId(req),
            metadata: {
                method: req.method,
                route: req.originalUrl,
                reason: "INVALID_OR_EXPIRED_ACCESS_TOKEN"
            }
        });
        res.status(401).json({ message: "Invalid or expired authentication token" });
    }
}

export const isLoggedIn = requireAuth;
export type { AuthIdentityPayload } from "../auth/types";
