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

const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;

const dbUrl = process.env.DATABASE_URL || `postgresql://${dbUser}:${dbPassword ? encodeURIComponent(dbPassword) : ""}@${dbHost}:${dbPort}/${dbName}`;

if (!process.env.DATABASE_URL && (!dbUser || !dbPassword || !dbHost || !dbPort || !dbName)) {
    throw new Error("Missing required PostgreSQL env variables (DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)");
}

export const AppDataSource = new DataSource({
    type: "postgres",
    url: dbUrl,
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
        const mUser = process.env.MONGO_USER;
        const mPass = process.env.MONGO_PASSWORD;
        const mHost = process.env.MONGO_HOST;
        const mPort = process.env.MONGO_PORT;
        const mDb = process.env.MONGO_DB;
        const mAuth = process.env.MONGO_AUTH_SOURCE;

        const mongoUrl = process.env.MONGO_URL || `mongodb://${mUser}:${mPass ? encodeURIComponent(mPass) : ""}@${mHost}:${mPort}/${mDb}?authSource=${mAuth}`;

        if (!process.env.MONGO_URL && (!mUser || !mPass || !mHost || !mPort || !mDb || !mAuth)) {
            throw new Error("Missing required MongoDB env variables (MONGO_URL or MONGO_USER, MONGO_PASSWORD, MONGO_HOST, MONGO_PORT, MONGO_DB, MONGO_AUTH_SOURCE)");
        }

        await mongoose.connect(mongoUrl);
        console.log("MongoDB connection established successfully.");

    } catch (error) {
        console.error("Error during Data Source initialization:", error);
        throw error;
    }
}
