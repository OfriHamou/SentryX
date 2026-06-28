import type { ReactNode } from 'react';
import { Button } from '@mui/material';

interface ActionButtonProps {
    icon: ReactNode;
    label: string;
    tone: 'primary' | 'danger';
    onClick?: () => void;
    disabled?: boolean;
}

export default function ActionButton({ icon, label, tone, onClick, disabled = false }: ActionButtonProps) {
    const palette = tone === 'danger'
        ? { bgcolor: '#F6BCC0', color: '#B23B43', hover: '#F1A8AD' }
        : { bgcolor: '#BCC5F4', color: '#3A45A0', hover: '#A9B4EF' };

    return (
        <Button onClick={onClick} disabled={disabled} fullWidth sx={{
            flexDirection: 'column', gap: 0.5, py: 2, borderRadius: 3,
            textTransform: 'none', fontWeight: 700,
            bgcolor: palette.bgcolor, color: palette.color,
            '&:hover': { bgcolor: palette.hover },
            '& .MuiSvgIcon-root': { fontSize: 26 },
        }}>
            {icon}
            {label}
        </Button>
    );
}
