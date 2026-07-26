export function alertDisplayTitle(eventType: string | null | undefined): string {
    const knownTitles: Record<string, string> = {
        face_detected_unknown: "Unknown person detected",
        motion_detected: "Motion detected",
        motion: "Motion detected",
        smoke: "Smoke detected",
        fire: "Fire detected",
        wet_floor_check: "Wet floor detected",
        zone_compliance: "Restricted area violation",
    };

    if (!eventType) return "Alert";
    if (knownTitles[eventType]) return knownTitles[eventType];

    const readable = eventType.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return readable.length > 0 ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Alert";
}
