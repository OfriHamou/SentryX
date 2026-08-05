import { VisitorStatus } from "../models/Visitor";
import { resolveVisitorStatus } from "./VisitorLifecycle";

const startAt = new Date("2026-08-05T10:00:00.000Z");
const endAt = new Date("2026-08-05T12:00:00.000Z");

function visitor(status: VisitorStatus = VisitorStatus.SCHEDULED) {
    return { startAt, endAt, status };
}

describe("resolveVisitorStatus", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it.each([
        ["before startAt", "2026-08-05T09:59:59.999Z", VisitorStatus.SCHEDULED],
        ["exactly at startAt", "2026-08-05T10:00:00.000Z", VisitorStatus.ACTIVE],
        ["between startAt and endAt", "2026-08-05T11:00:00.000Z", VisitorStatus.ACTIVE],
        ["exactly at endAt", "2026-08-05T12:00:00.000Z", VisitorStatus.EXPIRED],
        ["after endAt", "2026-08-05T12:00:00.001Z", VisitorStatus.EXPIRED],
    ])("resolves a visitor %s to %s", (_label, now, expected) => {
        expect(resolveVisitorStatus(visitor(), new Date(now))).toBe(expected);
    });

    it.each([
        ["before the visit", "2026-08-05T09:00:00.000Z"],
        ["during the visit", "2026-08-05T11:00:00.000Z"],
        ["after the visit", "2026-08-05T13:00:00.000Z"],
    ])("keeps CANCELLED status %s", (_label, now) => {
        expect(resolveVisitorStatus(visitor(VisitorStatus.CANCELLED), new Date(now))).toBe(
            VisitorStatus.CANCELLED,
        );
    });

    it.each([
        ["before the visit", "2026-08-05T09:00:00.000Z"],
        ["during the visit", "2026-08-05T11:00:00.000Z"],
        ["after the visit", "2026-08-05T13:00:00.000Z"],
    ])("keeps COMPLETED status %s", (_label, now) => {
        expect(resolveVisitorStatus(visitor(VisitorStatus.COMPLETED), new Date(now))).toBe(
            VisitorStatus.COMPLETED,
        );
    });

    it("respects the supplied now argument instead of the real clock", () => {
        jest.spyOn(Date, "now").mockReturnValue(new Date("2030-01-01T00:00:00.000Z").getTime());

        const status = resolveVisitorStatus(visitor(), new Date("2026-08-05T11:00:00.000Z"));

        expect(status).toBe(VisitorStatus.ACTIVE);
    });
});
