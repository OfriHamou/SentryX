import { useEffect, useRef, useState } from 'react';
import { Paper, Typography, TextField, Button, Stack } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';
import { useRobot } from '../../hooks/robot/useRobot';
import { customerApi } from '../../api/customerApi';

interface RobotConfigProps {
    canWrite: boolean;
}

export default function RobotConfig({ canWrite }: RobotConfigProps) {
    const { data: robot, refresh } = useRobot();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [saving, setSaving] = useState(false);
    const initialized = useRef(false);

    useEffect(() => {
        if (robot && !initialized.current) {
            setName(robot.name ?? '');
            setLocation(robot.location ?? '');
            initialized.current = true;
        }
    }, [robot]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await customerApi.put('/robot/current', { name, location });
            await refresh?.();
        } catch (e) {
            console.error('Failed to save robot config', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <ShieldIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Robot Configuration</Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Robot Name</Typography>
            <TextField fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Location</Typography>
            <TextField fullWidth size="small" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Hallway A" disabled={!canWrite} sx={{ mb: 2 }} />

            {canWrite && (
            <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', borderRadius: 2 }}>
                {saving ? 'Saving…' : 'Save'}
            </Button>
            )}
        </Paper>
    );
}
