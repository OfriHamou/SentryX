import { useState } from 'react';
import { Paper, Typography, Stack, Button, Alert, Box } from '@mui/material';
import { Home as DockIcon, PlayArrow as ResumeIcon, Stop as StopIcon, AddLocationAlt as AddLocationIcon, Pause as PauseIcon } from '@mui/icons-material';
import { useAutoPatrol } from '../../hooks/robot/useAutoPatrol';
import { useAutoPatrolStatus } from '../../hooks/robot/useAutoPatrolStatus';

export default function QuickActions() {
    const btnSx = { justifyContent: 'flex-start', textTransform: 'none', borderRadius: 2, py: 1.2 } as const;
    const { start, stop, isLoading } = useAutoPatrol();
    const { data: autoPatrolStatus } = useAutoPatrolStatus();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isAutoPatrolActive = autoPatrolStatus?.active ?? false;

    const handleStart = async () => {
        setErrorMsg(null);
        try {
            await start();
        } catch (err) {
            setErrorMsg((err as Error).message);
        }
    };

    const handleStop = async () => {
        setErrorMsg(null);
        try {
            await stop();
        } catch (err) {
            setErrorMsg((err as Error).message);
        }
    };

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quick Actions</Typography>
            <Stack spacing={1.5}>
                <Button 
                    startIcon={<DockIcon />} 
                    variant="outlined" 
                    disabled 
                    sx={btnSx}
                >
                    Return to Charging Dock
                </Button>

                {!isAutoPatrolActive ? (
                    <Button 
                        startIcon={<ResumeIcon />} 
                        variant="outlined" 
                        onClick={handleStart}
                        disabled={isLoading}
                        sx={btnSx}
                    >
                        Start Auto Patrol
                    </Button>
                ) : (
                    <Button 
                        startIcon={<PauseIcon />} 
                        variant="outlined" 
                        onClick={handleStop}
                        disabled={isLoading}
                        sx={btnSx}
                    >
                        Pause Auto Patrol
                    </Button>
                )}

                <Button 
                    startIcon={<StopIcon />} 
                    variant="contained" 
                    color="error" 
                    onClick={handleStop}
                    disabled={!isAutoPatrolActive || isLoading}
                    sx={btnSx}
                >
                    Stop Auto Patrol
                </Button>

                <Button 
                    startIcon={<AddLocationIcon />} 
                    variant="outlined" 
                    color="success" 
                    disabled 
                    sx={btnSx}
                >
                    Add specific location
                </Button>
            </Stack>

            {errorMsg && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                    {errorMsg}
                </Alert>
            )}

            {isAutoPatrolActive && autoPatrolStatus?.last_error && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                    {autoPatrolStatus.last_error}
                </Alert>
            )}

            {!isAutoPatrolActive && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                    Auto Patrol is available. Use Start Auto Patrol to begin autonomous obstacle avoidance.
                </Alert>
            )}

            {isAutoPatrolActive && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#E3F2FD', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                        Auto Patrol Active
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        State: {autoPatrolStatus?.state ?? 'unknown'}
                    </Typography>
                    {autoPatrolStatus?.last_detection && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Last detected: {autoPatrolStatus.last_detection.name} ({autoPatrolStatus.last_detection.score?.toFixed(2)})
                        </Typography>
                    )}
                </Box>
            )}
        </Paper>
    );
}