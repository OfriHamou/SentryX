import mongoose from "mongoose";
import { LogModel, type LogEntry, type LogLevel } from "../models/Log";

type LoggerMeta = Record<string, unknown> | undefined;

interface LoggerOptions {
    maxBufferSize?: number;
    flushIntervalMs?: number;
}

interface InternalLogRecord extends LogEntry {
    createdAt: Date;
}

const SENSITIVE_KEYS = new Set([
    "password",
    "token",
    "accesstoken",
    "refreshtoken",
    "authorization",
    "cookie",
    "secret",
    "apikey"
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function redactValue(value: unknown, visited = new WeakSet<object>()): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "bigint") {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map((entry) => redactValue(entry, visited));
    }

    if (isPlainObject(value)) {
        if (visited.has(value)) {
            return "[Circular]";
        }

        visited.add(value);
        const output: Record<string, unknown> = {};

        for (const [key, nestedValue] of Object.entries(value)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                output[key] = "[REDACTED]";
                continue;
            }

            output[key] = redactValue(nestedValue, visited);
        }

        return output;
    }

    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }

    if (typeof value === "function") {
        return "[Function]";
    }

    return value;
}

function normalizeMeta(meta?: LoggerMeta): Record<string, unknown> | undefined {
    if (!meta) {
        return undefined;
    }

    const redacted = redactValue(meta);
    return isPlainObject(redacted) ? redacted : undefined;
}

function extractField(meta: Record<string, unknown> | undefined, key: string): string | undefined {
    if (!meta) {
        return undefined;
    }

    const value = meta[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stripFields(meta: Record<string, unknown> | undefined, keys: string[]): Record<string, unknown> | undefined {
    if (!meta) {
        return undefined;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
        if (keys.includes(key)) {
            continue;
        }
        cleaned[key] = value;
    }

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function normalizeError(error: unknown): { errorMessage?: string; errorStack?: string } {
    if (!error) {
        return {};
    }

    if (error instanceof Error) {
        return {
            errorMessage: error.message,
            errorStack: error.stack
        };
    }

    if (typeof error === "string") {
        return { errorMessage: error };
    }

    if (isPlainObject(error)) {
        const message = typeof error.message === "string" ? error.message : undefined;
        const stack = typeof error.stack === "string" ? error.stack : undefined;

        return {
            errorMessage: message,
            errorStack: stack
        };
    }

    return { errorMessage: String(error) };
}

class MongoBufferedLogger {
    private readonly maxBufferSize: number;

    private readonly flushIntervalMs: number;

    private readonly buffer: InternalLogRecord[] = [];

    private flushTimer: NodeJS.Timeout | null = null;

    private flushInProgress = false;

    private flushRequested = false;

    constructor(options: LoggerOptions = {}) {
        this.maxBufferSize = options.maxBufferSize ?? 50;
        this.flushIntervalMs = options.flushIntervalMs ?? 10000;
        this.startTimer();
    }

    info(message: string, meta?: LoggerMeta): void {
        this.enqueue("info", message, undefined, meta);
    }

    warn(message: string, meta?: LoggerMeta): void {
        this.enqueue("warn", message, undefined, meta);
    }

    debug(message: string, meta?: LoggerMeta): void {
        this.enqueue("debug", message, undefined, meta);
    }

    error(message: string, error?: unknown, meta?: LoggerMeta): void {
        const looksLikeError =
            error instanceof Error ||
            typeof error === "string" ||
            (isPlainObject(error) && (typeof error.message === "string" || typeof error.stack === "string"));

        if (meta !== undefined) {
            this.enqueue("error", message, error, meta);
            return;
        }

        if (looksLikeError) {
            this.enqueue("error", message, error, undefined);
            return;
        }

        this.enqueue("error", message, undefined, error as LoggerMeta);
    }

    async flush(): Promise<void> {
        if (this.flushInProgress) {
            this.flushRequested = true;
            return;
        }

        this.flushInProgress = true;

        try {
            while (this.buffer.length > 0) {
                if (mongoose.connection.readyState !== 1) {
                    this.dropBufferedLogs("MongoDB is not connected");
                    break;
                }

                const batch = this.buffer.splice(0, this.maxBufferSize);

                if (batch.length === 0) {
                    break;
                }

                try {
                    await LogModel.insertMany(batch, { ordered: false });
                } catch (error) {
                    console.error(`[logger] Failed to write ${batch.length} log(s) to MongoDB. Dropping batch.`, error);
                }
            }
        } finally {
            this.flushInProgress = false;

            if (this.flushRequested) {
                this.flushRequested = false;
                if (this.buffer.length > 0) {
                    await this.flush();
                }
            }
        }
    }

    private enqueue(level: LogLevel, message: string, error?: unknown, meta?: LoggerMeta): void {
        const normalizedMeta = normalizeMeta(meta);
        const context = extractField(normalizedMeta, "context") ?? extractField(normalizedMeta, "module");
        const moduleName = extractField(normalizedMeta, "module");
        const userId = extractField(normalizedMeta, "userId");
        const requestId = extractField(normalizedMeta, "requestId");
        const errorFields = normalizeError(error);

        const logRecord: InternalLogRecord = {
            level,
            message,
            meta: stripFields(normalizedMeta, ["context", "module", "userId", "requestId"]),
            context,
            module: moduleName,
            userId,
            requestId,
            errorMessage: errorFields.errorMessage,
            errorStack: errorFields.errorStack,
            createdAt: new Date()
        };

        this.buffer.push(logRecord);

        if (this.buffer.length >= this.maxBufferSize) {
            void this.flush();
        }
    }

    private startTimer(): void {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setInterval(() => {
            void this.flush();
        }, this.flushIntervalMs);

        this.flushTimer.unref?.();
    }

    private dropBufferedLogs(reason: string): void {
        if (this.buffer.length === 0) {
            return;
        }

        const batchSize = this.buffer.length;
        this.buffer.length = 0;
        console.error(`[logger] ${reason}. Dropping ${batchSize} buffered log(s).`);
    }
}

export const logger = new MongoBufferedLogger();
export type LoggerService = MongoBufferedLogger;