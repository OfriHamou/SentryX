import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/services/token";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "Missing or invalid authorization header" });
        return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
        res.status(401).json({ message: "Missing authentication token" });
        return;
    }

    try {
        res.locals.auth = verifyAccessToken(token);
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired authentication token" });
    }
}

export const isLoggedIn = requireAuth;
export type { AuthIdentityPayload } from "../auth/types";
