import { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { Mic as MicIcon, MicOff as MicOffIcon, Notifications as AlarmIcon, Phone as PhoneIcon } from '@mui/icons-material';
import JoystickControl from '../JoystickControl';
import { useRobotMove } from '../../../hooks/robot/useRobotMove';


const DISABLED_ACTION_SX = {
    bgcolor: 'rgba(0, 0, 0, 0.4)',
    color: 'rgba(255, 255, 255, 0.35)',
};

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
                    disabled
                    onClick={handleTalkToggle}
                    sx={{
                        bgcolor: talking ? 'primary.main' : 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        '&:hover': { 
                            bgcolor: talking ? 'primary.dark' : 'rgba(0, 0, 0, 0.8)',
                        },
                        '&.Mui-disabled': DISABLED_ACTION_SX,
                    }}
                >
                    {talking ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton
                    disabled
                    onClick={onAlarm}
                    sx={{
                        bgcolor: 'error.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'error.dark' },
                        '&.Mui-disabled': DISABLED_ACTION_SX,
                    }}
                >
                    <AlarmIcon />
                </IconButton>
                <IconButton
                    disabled
                    onClick={onCallEmergency}
                    sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&.Mui-disabled': DISABLED_ACTION_SX,
                    }}
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