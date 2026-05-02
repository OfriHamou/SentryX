import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const positionStyles: Record<Position, object> = {
    'top-left': { top: 12, left: 12 },
    'top-right': { top: 12, right: 12 },
    'bottom-left': { bottom: 12, left: 12 },
    'bottom-right': { bottom: 12, right: 12 },
};

interface VideoOverlayProps {
    position: Position;
    children: ReactNode;
}

export default function VideoOverlay({ position, children }: VideoOverlayProps) {
    return (
        <Box
            sx={{
                position: 'absolute',
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                px: 1.5,
                py: 0.75,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                ...positionStyles[position],
            }}
        >
            {children}
        </Box>
    );
}
