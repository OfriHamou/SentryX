import { Box } from '@mui/material';
import { Joystick } from 'react-joystick-component';
import type { MoveInput } from '../../types/robot';


interface JoystickControlProps {
    onMove: (input: MoveInput) => void;
    onStop: () => void;
    size?: number;
    baseColor?: string;
    stickColor?: string;
}

export default function JoystickControl({
    onMove,
    onStop,
    size = 120,
    baseColor = 'rgba(0, 0, 0, 0.3)',
    stickColor = '#8B9BE8',
}: JoystickControlProps) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Joystick
                size={size}
                baseColor={baseColor}
                stickColor={stickColor}
                move={(event) => {
                    onMove({ 
                        speed: event.y ?? 0, // Y>0 is forward, Y<0 is backward
                        rotation: event.x ?? 0, // X>0 is right, X<0 is left
                    });
                }}
                stop={() => onStop()}
            />
        </Box>
    );
}