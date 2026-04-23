import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthIdentityPayload {
    userId: string;
    tenantId: string;
    roleId: number;
    roleName?: string;
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("Missing required JWT_SECRET env variable");
    }
    return secret;
}

export function signAuthToken(payload: AuthIdentityPayload): string {
    const secret = getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || "1h";

    return jwt.sign(payload, secret, {
        expiresIn: expiresIn as jwt.SignOptions["expiresIn"]
    });
}

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
        const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & Partial<AuthIdentityPayload>;

        if (!decoded.userId || !decoded.tenantId || typeof decoded.roleId !== "number") {
            res.status(401).json({ message: "Invalid authentication token payload" });
            return;
        }

        res.locals.auth = {
            userId: decoded.userId,
            tenantId: decoded.tenantId,
            roleId: decoded.roleId,
            roleName: decoded.roleName
        } as AuthIdentityPayload;

        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired authentication token" });
    }
}
