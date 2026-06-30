import { AppDataSource } from "../../backend/src/db";
export type TaskStatus = "RUNNING" | "SUCCESS" | "FAILED";

export abstract class PeriodicBase {
    public abstract readonly taskName: string;
    public abstract readonly intervalMinutes: number;

    public abstract handle(tenantId: string): Promise<void>;

    /**
     * Orchestrates the execution sequence and persists logs into PostgreSQL.
     */
    public async execute(tenantId: string): Promise<void> {
        const startTime = new Date();
        let status: TaskStatus = "RUNNING";
        let caughtErrorMessage: string | null = null; // Track error text across scopes
        let insertedId: number | null = null;


        // Create row indicating a run
        try {
            const insertSql = `
                INSERT INTO periodic_execution_history (start_time, end_time, tenant_id, task_name, status, error_message)
                VALUES ($1, NULL, $2, $3, $4, NULL)
                    RETURNING id;
            `;

            const rows = await AppDataSource.query(insertSql, [startTime, tenantId, this.taskName, status]);

            if (rows && rows.length > 0) {
                insertedId = rows[0].id;
            }
        } catch (dbError) {
            console.error(`[TypeORM Init Error] Failed to write initial history for ${this.taskName}:`, dbError);
        }

        // Start working in the actual job. 'insertedId' is the ID for the record in the DB
        try {
            await this.handle(tenantId);
            status = "SUCCESS";
        } catch (error: any) {
            status = "FAILED";
            // Extract a clean string representation of the exception message
            caughtErrorMessage = error?.message || String(error);
            console.error(`[Execution Error] Task "${this.taskName}" failed for tenant "${tenantId}":`, error);
        } finally {
            const endTime = new Date();

            // Update execution row with status and runtime finish date
            if (insertedId !== null) {
                try {
                    const updateSql = `
                        UPDATE periodic_execution_history
                        SET end_time = $1, status = $2, error_message = $3
                        WHERE id = $4;
                    `;
                    await AppDataSource.query(updateSql, [endTime, status, caughtErrorMessage, insertedId]);
                } catch (dbUpdateError) {
                    console.error(`[TypeORM Update Error] Failed to finalize history row ID ${insertedId}:`, dbUpdateError);
                }
            }
        }
    }
}