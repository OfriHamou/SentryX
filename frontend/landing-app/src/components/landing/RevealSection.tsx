import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export default function RevealSection({ children }: { children: ReactNode }) {
    const { ref, visible } = useScrollReveal<HTMLDivElement>();

    return (
        <Box
            ref={ref}
            sx={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(28px)',
                transition: 'opacity .7s ease, transform .7s cubic-bezier(.2,.7,.3,1)',
            }}
        >
            {children}
        </Box>
    );
}