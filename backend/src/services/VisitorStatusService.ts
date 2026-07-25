import { AppDataSource } from "../db";
import { Visitor, VisitorStatus } from "../models/Visitor";
import { resolveVisitorStatus } from "./VisitorLifecycle";

export { resolveVisitorStatus };

export async function syncVisitorDerivedStatus(visitor: Visitor, now = new Date()): Promise<boolean> {
    if (visitor.status === VisitorStatus.CANCELLED || visitor.status === VisitorStatus.COMPLETED) {
        return false;
    }

    const resolvedStatus = resolveVisitorStatus(visitor, now);
    if (visitor.status === resolvedStatus) {
        return false;
    }

    visitor.status = resolvedStatus;
    await AppDataSource.getRepository(Visitor).save(visitor);
    return true;
}
