import { useEffect, useRef, useState } from 'react';
import { Paper, Typography, TextField, Switch, FormControlLabel, Box, Button, Stack } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';
import { useRobot } from '../../hooks/robot/useRobot';
import { customerApi } from '../../api/customerApi';

export default function RobotConfig() {
    const { data: robot, refresh } = useRobot();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [autoPatrol, setAutoPatrol] = useState(false);
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
            <TextField fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Location</Typography>
            <TextField fullWidth size="small" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Hallway A" sx={{ mb: 2 }} />

            <Box sx={{ opacity: 0.6, mb: 2 }}>
                <FormControlLabel
                    control={<Switch checked={autoPatrol} onChange={(e) => setAutoPatrol(e.target.checked)} disabled />}
                    label="Enable Auto Patrol" />
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>Coming soon — needs patrol engine</Typography>
            </Box>

            <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', borderRadius: 2 }}>
                {saving ? 'Saving…' : 'Save'}
            </Button>
        </Paper>
    );
}
