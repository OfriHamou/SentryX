import { Box, Button, Stack, Alert, Typography } from '@mui/material';
import {
    Mic as MicIcon,
    Notifications as AlarmIcon,
    Phone as PhoneIcon,
} from '@mui/icons-material';
import JoystickControl from '../JoystickControl';
import { useRobotMove } from '../../../hooks/robot/useRobotMove';

interface ActionPanelProps {
    canControl: boolean;
}

export default function ActionPanel({ canControl }: ActionPanelProps) {
    const { move, stop } = useRobotMove();

    return (
        <Stack spacing={2}>
            {!canControl && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Read-only live access
                </Alert>
            )}
            {/* The robot has no microphone, speaker or alarm output yet. These stay
                visible so the plan is clear, but inert so nothing false is promised. */}
            <Button variant="outlined" startIcon={<MicIcon />} disabled
                sx={{ py: 1.5, textTransform: 'none', borderRadius: 3 }}>
                Talk
            </Button>

            <Button variant="outlined" startIcon={<AlarmIcon />} disabled
                sx={{ py: 1.5, textTransform: 'none', borderRadius: 3 }}>
                Trigger Alarm
            </Button>

            <Button variant="outlined" startIcon={<PhoneIcon />} disabled
                sx={{ py: 1.5, textTransform: 'none', borderRadius: 3 }}>
                Call Emergency
            </Button>

            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
                Coming soon — needs robot audio and alarm hardware
            </Typography>

            <Box sx={{ pt: 2 }}>
                {canControl && <JoystickControl size={140} onMove={move} onStop={stop} />}
            </Box>
        </Stack>
    );
}
