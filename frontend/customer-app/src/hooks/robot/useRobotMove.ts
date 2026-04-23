import { useRef, useState } from 'react';
import { moveRobot, stopRobot } from '../../api/robot';
import type { MoveInput } from '../../types/robot';

// Throttle rule: don't flood the robot with requests.
// The joystick fires many events/sec — cap it at MAX_SENDS_PER_SECOND.
const MAX_SENDS_PER_SECOND = 10;
const MIN_INTERVAL_MS = 1000 / MAX_SENDS_PER_SECOND;

export function useRobotMove() {
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // When (ms timestamp) did we last successfully send?
    const lastSendTimestampRef = useRef(0);

     // Latest joystick value that's waiting inside the throttle window.
    const pendingMoveRef = useRef<MoveInput | null>(null);

    // Timer ID for the scheduled "send the pending value" call.
    const pendingSendTimerRef = useRef<number | null>(null);
    
    const sendMove = async (input: MoveInput) => {
        setIsSending(true);
        try {
            await moveRobot(input);
            setErrorMessage(null);
            lastSendTimestampRef.current = Date.now();
        } catch (err) {
            console.warn('Move failed:', err);
            setErrorMessage((err as Error).message);
        } finally {
            setIsSending(false);
        }
    };

    const move = (input: MoveInput) => {
        const now = Date.now();
        const msSinceLastSend = now - lastSendTimestampRef.current;

        // Enough time passed → send immediately
        if (msSinceLastSend >= MIN_INTERVAL_MS) {
            sendMove(input);
            return;
        }

        // Too soon → save latest value; schedule a send later
        pendingMoveRef.current = input;
        if (pendingSendTimerRef.current !== null) return; // already scheduled

        const waitMs = MIN_INTERVAL_MS - msSinceLastSend;
        pendingSendTimerRef.current = window.setTimeout(() => {
            pendingSendTimerRef.current = null;
            const value = pendingMoveRef.current;
            pendingMoveRef.current = null;
            if (value) {
                sendMove(value);
            }
        },waitMs);
    };

    const stop = async () => {
        // Cancel any scheduled send
        if (pendingSendTimerRef.current !== null) {
            window.clearTimeout(pendingSendTimerRef.current);
            pendingSendTimerRef.current = null;
        }
        pendingMoveRef.current = null;

        try {
            await stopRobot();
            setErrorMessage(null);
        } catch (err) {
            console.warn('Stop failed:', err);
            setErrorMessage((err as Error).message);
        }
    };

    return { move, stop, isSending, errorMessage };
}