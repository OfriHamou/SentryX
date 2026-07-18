import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import type { AvoidanceHealth, AvoidanceStatus } from '../../types/robot';

interface AutoModePanelProps {
    status: AvoidanceStatus | null;
    health: AvoidanceHealth | null;
    loading: boolean;
    errorMessage: string | null;
    actionInProgress: boolean;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStop: () => Promise<void>;
}

function buildStateLabel(status: AvoidanceStatus | null) {
    if (!status) return 'Waiting for status...';
    if (!status.stream_connected) return 'Camera unavailable';
    if (!status.model_loaded) return 'Model unavailable';

    switch (status.state) {
        case 'FORWARD':
            return 'Driving forward';
        case 'BLOCKED':
            return 'Obstacle detected';
        case 'REVERSING':
            return 'Reversing';
        case 'TURNING':
            return status.last_turn_direction === 'right' ? 'Turning right' : 'Turning left';
        case 'PAUSED':
            return 'Paused';
        case 'ERROR':
            return status.error || 'Auto mode error';
        default:
            return 'Idle';
    }
}

function formatProbability(value: number | null) {
    return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export default function AutoModePanel({
    status,
    health,
    loading,
    errorMessage,
    actionInProgress,
    onPause,
    onResume,
    onStop,
}: AutoModePanelProps) {
    const stateLabel = buildStateLabel(status);
    const isPaused = status?.state === 'PAUSED';

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Auto Mode</Typography>

            <Stack spacing={2}>
                <Alert severity={status?.state === 'ERROR' ? 'error' : 'info'} sx={{ borderRadius: 2 }}>
                    {loading ? 'Loading autonomous-driving status...' : stateLabel}
                </Alert>

                {errorMessage && (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {errorMessage}
                    </Alert>
                )}

                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`Blocked ${formatProbability(status?.blocked_probability ?? null)}`} color="warning" variant="outlined" />
                    <Chip label={`Free ${formatProbability(status?.free_probability ?? null)}`} color="success" variant="outlined" />
                    <Chip label={status?.stream_connected ? 'Stream healthy' : 'Stream offline'} color={status?.stream_connected ? 'success' : 'error'} variant="outlined" />
                    <Chip label={status?.model_loaded ? 'Model ready' : 'Model missing'} color={status?.model_loaded ? 'success' : 'error'} variant="outlined" />
                    <Chip label={health?.ros_motor_service_available ? 'Motor service ready' : 'Motor service unavailable'} color={health?.ros_motor_service_available ? 'success' : 'error'} variant="outlined" />
                </Stack>

                <Box sx={{ bgcolor: '#EEF0FB', borderRadius: 2, p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Current auto-driving status</Typography>
                    <Stack spacing={0.75}>
                        <Typography variant="body2">State: <strong>{status?.state ?? '—'}</strong></Typography>
                        <Typography variant="body2">Last action: <strong>{status?.last_action ?? '—'}</strong></Typography>
                        <Typography variant="body2">Last turn: <strong>{status?.last_turn_direction ?? '—'}</strong></Typography>
                        <Typography variant="body2">Blocked frames: <strong>{status?.blocked_frames ?? 0}</strong></Typography>
                        <Typography variant="body2">Last frame: <strong>{status?.last_frame_time ?? '—'}</strong></Typography>
                    </Stack>
                </Box>

                <Stack spacing={1.5}>
                    <Button variant="outlined" onClick={() => void onPause()} disabled={actionInProgress || isPaused}>
                        Pause
                    </Button>
                    <Button variant="outlined" onClick={() => void onResume()} disabled={actionInProgress || !isPaused}>
                        Resume
                    </Button>
                    <Button variant="contained" color="error" onClick={() => void onStop()} disabled={actionInProgress}>
                        Stop
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );
}
