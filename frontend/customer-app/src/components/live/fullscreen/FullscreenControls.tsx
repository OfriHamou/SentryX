import { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import {
  //FullscreenExit as ExitIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Notifications as AlarmIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import JoystickControl from '../JoystickControl';
import { useRobotMove } from '../../../hooks/robot/useRobotMove';

interface FullscreenControlsProps {
    onExitFullscreen: () => void;
    onTalkToggle: (active: boolean) => void;
    onAlarm: () => void;
    onCallEmergency: () => void;
}

export default function FullscreenControls({
    //onExitFullscreen,
    onTalkToggle,
    onAlarm,
    onCallEmergency,
}: FullscreenControlsProps) {
    const [talking, setTalking] = useState(false);
    const { move, stop } = useRobotMove();

    const handleTalkToggle = () => {
        const next = !talking;
        setTalking(next);
        onTalkToggle(next);
    };

    return (
        <>
            {/* Action buttons - top right */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 60,
                    right: 16,
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                }}
            >
                <IconButton
                    onClick={handleTalkToggle}
                    sx={{
                        bgcolor: talking ? 'primary.main' : 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        '&:hover': { 
                            bgcolor: talking ? 'primary.dark' : 'rgba(0, 0, 0, 0.8)',
                        },
                    }}
                >
                    {talking ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton
                    onClick={onAlarm}
                    sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
                >
                    <AlarmIcon />
                </IconButton>
                <IconButton
                    onClick={onCallEmergency}
                    sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                    <PhoneIcon />
                </IconButton>
            </Box>

            {/* Joystick controls - bottom right */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 36,
                    right: 36,
                    zIndex: 10,
                }}
            >
                <JoystickControl
                    size={120}
                    onMove={move}
                    onStop={stop}
                    baseColor='rgba(255,255,255,0.2)'
                    stickColor='#ffffff'
                />
            </Box>
        </>
    );
}        