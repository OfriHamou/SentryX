import { PeriodicBase } from "../base/PeriodicBase";

export class InvalidateVisitors extends PeriodicBase {
    public readonly taskName = "InvalidateVisitors";
    public readonly intervalMinutes = 1; // Run each minute. do "0" to run all the time

    public async handle(tenantId: string): Promise<void> {
        console.log(`🧾 [InvalidateVisitors] Im runninnggg for: ${tenantId}...`);
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        await sleep(5 * 1000)
        if (tenantId === "04381347-8811-4787-b6fd-bb8c53da5cf6") {
            throw new Error("Found OFIR!");
        }
    }
}