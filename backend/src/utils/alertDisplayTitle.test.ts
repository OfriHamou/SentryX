import { alertDisplayTitle } from "./alertDisplayTitle";

describe("alertDisplayTitle", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it.each([
        ["face_detected_unknown", "Unknown person detected"],
        ["motion_detected", "Motion detected"],
        ["motion", "Motion detected"],
        ["smoke", "Smoke detected"],
        ["fire", "Fire detected"],
        ["wet_floor_check", "Wet floor detected"],
        ["zone_compliance", "Restricted area violation"],
    ])("maps %s to its current user-facing title", (eventType, expected) => {
        expect(alertDisplayTitle(eventType)).toBe(expected);
    });

    it.each([null, undefined, "", "___", " _ _ "])("returns Alert for %s", (eventType) => {
        expect(alertDisplayTitle(eventType)).toBe("Alert");
    });

    it.each([
        ["battery_low", "Battery low"],
        ["robot_connection_lost", "Robot connection lost"],
        ["battery___low", "Battery low"],
        ["  battery_  low  ", "Battery low"],
        ["lowercase", "Lowercase"],
    ])("converts unknown value %s to readable text", (eventType, expected) => {
        expect(alertDisplayTitle(eventType)).toBe(expected);
    });

    it("does not throw for an unknown value", () => {
        expect(() => alertDisplayTitle("new_unknown_event")).not.toThrow();
    });
});
