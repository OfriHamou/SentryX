import mongoose, { Schema, type Document, type Model } from "mongoose";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
    level: LogLevel;
    message: string;
    meta?: Record<string, unknown>;
    context?: string;
    module?: string;
    userId?: string;
    requestId?: string;
    errorMessage?: string;
    errorStack?: string;
    createdAt?: Date;
}

export interface LogDocument extends LogEntry, Document {}

const LogSchema = new Schema<LogDocument>(
    {
        level: {
            type: String,
            enum: ["info", "warn", "error", "debug"],
            required: true,
            index: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        meta: {
            type: Schema.Types.Mixed,
            default: {}
        },
        context: {
            type: String,
            trim: true,
            required: false
        },
        module: {
            type: String,
            trim: true,
            required: false
        },
        userId: {
            type: String,
            trim: true,
            required: false,
            index: true
        },
        requestId: {
            type: String,
            trim: true,
            required: false,
            index: true
        },
        errorMessage: {
            type: String,
            required: false
        },
        errorStack: {
            type: String,
            required: false
        }
    },
    {
        collection: "logs",
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false
    }
);

export const LogModel: Model<LogDocument> =
    mongoose.models.Log || mongoose.model<LogDocument>("Log", LogSchema);