import { useState } from 'react';
import { Box, Button, Stack, Slider, IconButton, Alert } from '@mui/material';
import {
    Mic as MicIcon,
    MicOff as MicOffIcon,
    Notifications as AlarmIcon,
    Phone as PhoneIcon,
    VolumeUp as VolumeIcon,
} from '@mui/icons-material';
import JoystickControl from '../JoystickControl';
import { useRobotMove } from '../../../hooks/robot/useRobotMove';
 
interface ActionPanelProps {
    onTalkToggle?: (active: boolean) => void;
    onAlarm: () => void;
    onCallEmergency: () => void;
    volume: number;
    onVolumeChange: (value: number) => void;
    canControl: boolean;
}

export default function ActionPanel({
    onTalkToggle,
    onAlarm,
    onCallEmergency,
    volume,
    onVolumeChange,
    canControl,
}: ActionPanelProps) {
    const [talking, setTalking] = useState(false);
    const { move, stop } = useRobotMove();

    const handleTalkToggle = () => {
        const next = !talking;
        setTalking(next);
        onTalkToggle?.(next);
    };

    return (
        <Stack spacing={2}>
            {!canControl && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Read-only live access
                </Alert>
            )}
            <Button
                variant="outlined"
                startIcon={talking ? <MicOffIcon /> : <MicIcon />}
                onClick={handleTalkToggle}
                disabled={!canControl}
                sx={{
                    py: 1.5,
                    justifyContent: 'center',
                    textTransform: 'none',
                    bgcolor: talking ? 'primary.main' : 'transparent',
                    color: talking ? 'primary.contrastText' : 'text.primary',
                    borderColor: 'grey.300',
                    borderRadius: 3,
                }}
            >
                {talking ? 'Talking...' : 'Talk'}
            </Button>

            <Button
                variant="contained"
                color="error"
                startIcon={<AlarmIcon />}
                onClick={onAlarm}
                disabled={!canControl}
                sx={{ py:1.5, textTransform: 'none', borderRadius: 3 }}
            >
                Trigger Alarm
            </Button>

            <Button
                variant="contained"
                color="primary"
                startIcon={<PhoneIcon />}
                onClick={onCallEmergency}
                disabled={!canControl}
                sx={{ py:1.5, textTransform: 'none', borderRadius: 3 }}
            >
                Call Emergency
            </Button>

            <Box sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    pt: 1,
                }}
            >
            <IconButton size="small" disabled>
                <VolumeIcon />
            </IconButton>
            <Slider
                value={volume}
                onChange={(_, value) => onVolumeChange(value as number)}
                min={0}
                max={100}
                aria-label="Volume"
                disabled={!canControl}
            />
            </Box>
            <Box sx={{ pt: 2 }}>
                {canControl && <JoystickControl size={140} onMove={move} onStop={stop} />}
            </Box>
        </Stack>
    );
}
