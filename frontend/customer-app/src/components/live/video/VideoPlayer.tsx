import { Box, IconButton } from '@mui/material';
import { Fullscreen as FullscreenIcon } from '@mui/icons-material';
import { videoStreamUrl } from '../../../api/robot';
import type { BatteryLevel } from '../../../types/robot';
import LocationBadge from './LocationBadge';
import ClockBadge from './ClockBadge';
import BatteryBadge from './BatteryBadge';

interface VideoPlayerProps {
    location: string;
    batteryStatus: BatteryLevel | null;
    batteryVoltage: number | null;
    onFullscreenToggle: () => void;
}

export default function VideoPlayer({ 
    location,
    batteryStatus,
    batteryVoltage,
    onFullscreenToggle,
}: VideoPlayerProps) {
    return (
        <Box sx={{ 
            position: 'relative',
            bgcolor: 'black',
            borderRadius: 2,
            overflow: 'hidden',
            aspectRatio: '16/9',
            width: '100%',
            height: '100%',
            }}
            >
            <Box
                component="img"
                src={videoStreamUrl()}
                alt="Robot live video"
                sx={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />

            <LocationBadge text={location} />
            <ClockBadge />
            <BatteryBadge status={batteryStatus} voltage={batteryVoltage} />

            <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                <IconButton
                    onClick={onFullscreenToggle}
                    sx={{
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
                    }}
                >
                    <FullscreenIcon />
                </IconButton>
            </Box>
        </Box>
    );
}