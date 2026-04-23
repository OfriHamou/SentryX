import { useState } from 'react';
import { Box, Button, Stack, Slider, IconButton } from '@mui/material';
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
}

export default function ActionPanel({
    onTalkToggle,
    onAlarm,
    onCallEmergency,
    volume,
    onVolumeChange,
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
            <Button
                variant="outlined"
                startIcon={talking ? <MicOffIcon /> : <MicIcon />}
                onClick={handleTalkToggle}
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
                sx={{ py:1.5, textTransform: 'none', borderRadius: 3 }}
            >
                Trigger Alarm
            </Button>

            <Button
                variant="contained"
                color="primary"
                startIcon={<PhoneIcon />}
                onClick={onCallEmergency}
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
            />
            </Box>
            <Box sx={{ pt: 2 }}>
                <JoystickControl size={140} onMove={move} onStop={stop} />
            </Box>
        </Stack>
    );
}