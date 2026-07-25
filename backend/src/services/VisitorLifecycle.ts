import { Visitor, VisitorStatus } from "../models/Visitor";

export function resolveVisitorStatus(
    visitor: Pick<Visitor, "startAt" | "endAt" | "status">,
    now = new Date()
): VisitorStatus {
    if (visitor.status === VisitorStatus.CANCELLED) {
        return VisitorStatus.CANCELLED;
    }

    if (visitor.status === VisitorStatus.COMPLETED) {
        return VisitorStatus.COMPLETED;
    }

    if (now < visitor.startAt) {
        return VisitorStatus.SCHEDULED;
    }

    if (visitor.startAt <= now && now < visitor.endAt) {
        return VisitorStatus.ACTIVE;
    }

    return VisitorStatus.EXPIRED;
}
