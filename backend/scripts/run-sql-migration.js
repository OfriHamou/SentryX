const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.join(process.cwd(), ".env") });

function getDatabaseUrl() {
    const fromEnv = process.env.DATABASE_URL;
    if (fromEnv) {
        return fromEnv;
    }

    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT;
    const dbName = process.env.DB_NAME;

    if (!dbUser || !dbPassword || !dbHost || !dbPort || !dbName) {
        throw new Error(
            "Missing PostgreSQL env variables. Provide DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME."
        );
    }

    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
}

async function main() {
    const migrationArg = process.argv[2];
    if (!migrationArg) {
        throw new Error("Usage: node scripts/run-sql-migration.js <sql-file-path>");
    }

    const migrationPath = path.resolve(process.cwd(), migrationArg);
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`SQL file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    if (!sql.trim()) {
        throw new Error(`SQL file is empty: ${migrationPath}`);
    }

    const client = new Client({ connectionString: getDatabaseUrl() });
    await client.connect();

    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`Migration applied successfully: ${migrationArg}`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error("Failed to apply SQL migration:", error.message);
    process.exit(1);
});
