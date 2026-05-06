import { useEffect, useRef } from 'react';
import { Box, IconButton } from '@mui/material';
import { Fullscreen as FullscreenIcon } from '@mui/icons-material';
import { videoStreamUrl } from '../../../api/robot';
import type { BatteryLevel, Detection } from '../../../types/robot';
import LocationBadge from './LocationBadge';
import ClockBadge from './ClockBadge';
import BatteryBadge from './BatteryBadge';

interface VideoPlayerProps {
    location: string;
    batteryStatus: BatteryLevel | null;
    batteryVoltage: number | null;
    detections: Detection[];
    onFullscreenToggle: () => void;
}

export default function VideoPlayer({
    location,
    batteryStatus,
    batteryVoltage,
    detections,
    onFullscreenToggle,
}: VideoPlayerProps) {
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const img = imgRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        const draw = () => {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!img.naturalWidth || !img.naturalHeight) return;

            const scaleX = canvas.width / img.naturalWidth;
            const scaleY = canvas.height / img.naturalHeight;

            detections.forEach((det) => {
                const x = det.x * scaleX;
                const y = det.y * scaleY;
                const w = det.w * scaleX;
                const h = det.h * scaleY;

                const color = det.is_known ? '#00ff66' : '#ff3b30';
                const label = det.is_known
                    ? `${det.name} (${det.confidence}%)`
                    : 'Unknown';

                ctx.lineWidth = 3;
                ctx.strokeStyle = color;
                ctx.strokeRect(x, y, w, h);

                ctx.font = '14px Arial';
                const textWidth = ctx.measureText(label).width;
                const labelY = Math.max(0, y - 22);
                ctx.fillStyle = color;
                ctx.fillRect(x, labelY, textWidth + 12, 22);
                ctx.fillStyle = '#000';
                ctx.fillText(label, x + 6, labelY + 16);
            });
        };

        draw();
        window.addEventListener('resize', draw);
        document.addEventListener('fullscreenchange', draw);
        return () => {
            window.removeEventListener('resize', draw);
            document.removeEventListener('fullscreenchange', draw);
        };
    }, [detections]);

    return (
        <Box sx={{
            position: 'relative',
            bgcolor: 'black',
            borderRadius: 2,
            overflow: 'hidden',
            width: '100%',
            height: '100%',
        }}>
            <Box
                ref={imgRef}
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

            <Box
                ref={canvasRef}
                component="canvas"
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
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