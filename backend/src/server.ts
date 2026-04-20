import dotenv from "dotenv";
import path from "path";

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

export const app = express();

function prerequisites() {
    const allowedOrigins = [
        process.env.SERVER_ADDRESS,
        process.env.CLIENT_ORIGIN || "http://localhost:3000",
        "http://localhost:4000",  // Local server
        "http://localhost:5173",  // Local FE
    ].filter(Boolean) as string[];

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed by CORS" ${origin}`));
            }
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
    app.get("/api/health", (req, res) => {
        res.status(200).json({ status: "OK" });
    });

    // Mount our Tenant routes under /api/tenants
    app.use("/api/tenants", tenantRoutes);
    // Mount our License routes under /api/licenses
    app.use("/api/licenses", licenseRoutes);

    // serve index.html for all non-API routes (/login, /profile, etc.)
    app.use((req, res) => {
        const clientDistPath = path.join(__dirname, "..", "..", "frontend", "build");
        res.sendFile(path.join(clientDistPath, "index.html"));
    });
}

async function runServer() {
    prerequisites();
    const server = http.createServer(app);
    app.use(express.json());

    // Make sure this is the last function we are calling
    initializeRoutes(app);

    await connectDB();

    const port = Number(process.env.PORT || 4000);

    if (process.env.NODE_ENV !== 'test') {
        const startListening = (attemptsLeft: number) => {
            server.removeAllListeners('error');
            server.listen(port, () => {
                console.log(`Service is listening on port ${port}`);
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

        const shutdown = () => {
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 1500).unref();
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT',  shutdown);
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
