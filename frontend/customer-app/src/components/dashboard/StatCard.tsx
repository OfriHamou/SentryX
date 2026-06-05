import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface StatCardProps {
    value: string;
    label: string;
    subtitle?: string;
    icon: ReactNode;
    iconColor: string;
    iconBg: string;
}

export default function StatCard({ value, label, subtitle, icon, iconColor, iconBg }: StatCardProps) {
    return (
        <Paper elevation={0} sx={{
            p: 3, borderRadius: 3, height: '100%',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            border: '1px solid', borderColor: 'grey.200',
        }}>
            <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>{label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
                {subtitle && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>}
            </Box>
            <Box sx={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: iconBg, color: iconColor,
            }}>
                {icon}
            </Box>
        </Paper>
    );
}