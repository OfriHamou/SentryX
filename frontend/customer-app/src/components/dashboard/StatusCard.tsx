import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface StatusCardProps {
    icon: ReactNode;
    label: string;
    value: string;
    valueColor?: string;
}

export default function StatusCard({ icon, label, value, valueColor }: StatusCardProps) {
    return (
        <Paper elevation={0} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, borderRadius: 2.5,
            height: '100%', border: '1px solid', borderColor: 'grey.200', bgcolor: '#fff',
        }}>
            <Box sx={{ 
                width: 44, height: 44, borderRadius: 2, flexShrink: 0, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: '#EEF0FB', color: 'primary.dark',
            }}>
                {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: valueColor ?? 'text.primary' }}>{value}</Typography>
            </Box>
        </Paper>
    );
}
