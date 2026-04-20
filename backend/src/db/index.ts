import { DataSource } from "typeorm";
import { Tenant } from "../models/Tenant";
import { Role } from "../models/Role";
import { User } from "../models/User";
import { Robot } from "../models/Robot";
import { Notification } from "../models/Notification";
import { RobotConfig } from "../models/RobotConfig";
import { Event } from "../models/Event";
import { License } from "../models/License";
import { TenantLicense } from "../models/TenantLicense";
import mongoose from "mongoose";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sentryx",
    synchronize: false, // Turn off synchronize in production, use migrations instead
    logging: process.env.NODE_ENV !== "production",
    entities: [
        Tenant,
        Role,
        User,
        Robot,
        Notification,
        RobotConfig,
        Event,
        License,
        TenantLicense
    ],
    migrations: [],
    subscribers: [],
});

export async function connectDB() {
    try {
        await AppDataSource.initialize();
        console.log("PostgreSQL mapping established successfully.");

        // Connect to MongoDB
        const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/sentryx_mongo";
        await mongoose.connect(mongoUrl);
        console.log("MongoDB connection established successfully.");

    } catch (error) {
        console.error("Error during Data Source initialization:", error);
        throw error;
    }
}
