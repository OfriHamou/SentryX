import { connectDB } from "../backend/src/db";
import { PeriodicBase } from "./base/PeriodicBase";
import {InvalidateVisitors} from "./tasks/InvalidateVisitors";
import { Tenant } from "../backend/src/models/Tenant";
import { AppDataSource } from "../backend/src/db/";

type PeriodicTaskConstructor = new () => PeriodicBase;

// Dynamic Registry of all targeted Tasks
const registeredTasks: PeriodicTaskConstructor[] = [
    InvalidateVisitors
];

interface TenantInfo {
    id: string;
    name: string;
}

async function getActiveTenants(): Promise<TenantInfo[]> {
    try {
        const tenantRepository = AppDataSource.getRepository(Tenant);
        const tenants = await tenantRepository.find();

        // Return both the ID and the Name
        return tenants.map(tenant => ({
            id: tenant.id,
            name: tenant.name
        }));

    } catch (error) {
        console.error("Failed to fetch active tenants from database:", error);
        return [];
    }
}

// Global runtime memory registry to track absolute timestamps per tenant rule
const executionRegistry: Record<string, number> = {};

async function orchestratorEngine(): Promise<void> {
    const now = new Date();
    const currentTimestamp = now.getTime();

    // Check if RUN_CONCURRENTLY is explicitly set to "true"
    const isConcurrent = process.env.RUN_CONCURRENTLY === "true";

    console.log(`\n[Orchestrator Engine] Evaluating rules at ${now.toISOString()}...`);
    console.log(`[Mode] Running in ${isConcurrent ? "PARALLEL" : "SEQUENTIAL"} execution mode.`);

    const tenants = await getActiveTenants();
    const executionPromises: Promise<void>[] = [];

    for (const TaskClass of registeredTasks) {
        const taskInstance = new TaskClass();

        for (const tenant of tenants) {
            const registryKey = `${taskInstance.taskName}_${tenant.name}`;
            const lastRun = executionRegistry[registryKey];
            const minutesSinceLastRun = lastRun ? (currentTimestamp - lastRun) / 1000 / 60 : null;

            if (!lastRun || (minutesSinceLastRun !== null && minutesSinceLastRun >= taskInstance.intervalMinutes)) {
                executionRegistry[registryKey] = currentTimestamp;

                if (isConcurrent) {
                    // Parallel Mode: Collect the promises without awaiting them immediately
                    const promise = taskInstance.execute(tenant.id);
                    executionPromises.push(promise);
                } else {
                    // Sequential Mode: Await right here inside the loop block
                    await taskInstance.execute(tenant.id);
                }
            }
        }
    }

    // If we are in concurrent mode, wait for the entire gathered batch to finish processing
    if (isConcurrent && executionPromises.length > 0) {
        await Promise.all(executionPromises);
    }

    console.log(`[Orchestrator Engine] All tasks handled for this tick.`);
}


async function startService() {
    try {
        await connectDB();
        console.log("All database pools ready. Booting Scheduler...");

        await orchestratorEngine();
        setInterval(orchestratorEngine, 60 * 1000);  // Run this function each 60 seconds

    } catch (error) {
        console.error("FATAL: Failed to initiate orchestration engine background thread:", error);
        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    console.log("Shutting down worker threads cleanly...");
    process.exit(0);
});

startService();