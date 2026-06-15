import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.join(__dirname, "..", ".env");
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
    console.error(`[env] Error loading .env file from ${envPath}:`, envResult.error);
} else {
    console.log(`[env] Successfully loaded .env file from ${envPath}`);
    console.log(`[env] Loaded DB_HOST: ${process.env.DB_HOST}`);
}

import express from "express";
import http from "http";
import cors from "cors";
import "reflect-metadata";
import { connectDB } from "./db";
import tenantRoutes from "./routes/tenantRoutes";
import licenseRoutes from "./routes/licenseRoutes";
import robotRoutes from "./routes/robotRoutes";
import authRoutes from "./routes/authRoutes";
import roleRoutes from "./routes/roleRoutes";
import eventRoutes from "./routes/eventRoutes";
import faceRoutes from "./routes/faceRoutes";
import { logger } from "./utils/logger";

export const app = express();

function prerequisites() {
    const allowedOrigins = [
        process.env.SERVER_ADDRESS,
        process.env.CLIENT_ORIGIN || "http://localhost:3000",
        "http://localhost:4000",  // Local server
        "http://localhost:5173",  // Local FE
        "https://sentryx.cs.colman.ac.il", // Production FE
    ].filter(Boolean) as string[];

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
                return callback(null, true);
            }
            callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    }));

    // Serve static files from public directory
    const publicPath = path.join(__dirname, "..", "public");
    app.use(express.static(publicPath));

    // Serve React app static files from frontend/build at root
    const clientDistPath = path.join(__dirname, "..", "..", "frontend", "build");
    app.use(express.static(clientDistPath));
}

function initializeRoutes(app: express.Application) {
    const clientDistPath = path.join(__dirname, "..", "..", "frontend", "build");
    const clientIndexPath = path.join(clientDistPath, "index.html");

    app.get("/api/health", (req, res) => {
        res.status(200).json({ status: "OK" });
    });

    // Mount our Tenant routes under /api/tenants
    app.use("/api/tenants", tenantRoutes);

    // Mount our License routes under /api/licenses
    app.use("/api/licenses", licenseRoutes);
    // Mount our Role routes under /api/roles
    app.use("/api/roles", roleRoutes);
    // Mount auth routes under /api/auth
    app.use("/api/auth", authRoutes);
    // Mount event routes under /api/events
    app.use("/api/events", eventRoutes);

    // Mount our Robot routes under /api/robot
    app.use("/api/robot", robotRoutes);

    // Mount our Face routes under /api/faces
    app.use("/api/faces", faceRoutes);

    // serve index.html for all non-API routes (/login, /profile, etc.)
    app.use((req, res) => {
        if (fs.existsSync(clientIndexPath)) {
            res.sendFile(clientIndexPath);
            return;
        }

        res.status(404).json({ message: "Frontend build not found" });
    });
}

async function runServer() {
    prerequisites();
    const server = http.createServer(app);
    app.use(express.json());

    // Make sure this is the last function we are calling
    initializeRoutes(app);

    try {
        await connectDB();
    } catch (error) {
        console.warn('[db] Connection failed - server continues without DB:', error);
    }

    const port = Number(process.env.PORT || 4000);

    if (process.env.NODE_ENV !== 'test') {
        const startListening = (attemptsLeft: number) => {
            server.removeAllListeners('error');
            server.listen(port, () => {
                console.log(`Service is listening on port ${port}`);
                logger.info(`Service is listening on port ${port}`, {
                    category: "SYSTEM",
                    action: "SERVER_STARTED",
                    status: "SUCCESS",
                    context: "server",
                    metadata: { port }
                });
            });
            server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
                    console.warn(`[server] Port ${port} busy - retrying in 2 s (${attemptsLeft} left)…`);
                    server.close();
                    setTimeout(() => startListening(attemptsLeft - 1), 2000);
                } else {
                    console.error('[server] Fatal listen error:', err.message);
                    process.exit(1);
                }
            });
        };
        startListening(5);

        const shutdown = (signal: "SIGTERM" | "SIGINT") => () => {
            logger.info("Server shutdown signal received", {
                category: "SYSTEM",
                action: "SERVER_SHUTDOWN_SIGNAL",
                status: "STARTED",
                context: "server",
                metadata: { signal }
            });

            const forceExitTimer = setTimeout(() => process.exit(0), 1500);
            forceExitTimer.unref();

            void logger.flush()
                .catch((error) => {
                    console.error("[logger] Flush failed during shutdown:", error);
                })
                .finally(() => {
                    server.close(() => {
                        logger.info("Server shutdown complete", {
                            category: "SYSTEM",
                            action: "SERVER_SHUTDOWN_COMPLETE",
                            status: "SUCCESS",
                            context: "server"
                        });
                        clearTimeout(forceExitTimer);
                        process.exit(0);
                    });
                });
        };
        process.on('SIGTERM', shutdown('SIGTERM'));
        process.on('SIGINT',  shutdown('SIGINT'));
    }
}

async function start() {
    await runServer();
}

export let serverInitPromise: Promise<void> | null = null;

if (require.main === module) {
    start().then(() => {});
} else {
    serverInitPromise = runServer();
}
