import { useState } from 'react';
import { Paper, Typography, Stack, TextField, Switch, FormControlLabel, Box } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';

export default function RobotConfig({ defaultName }: { defaultName?: string }) {
    const [name, setName] = useState(defaultName ?? 'Lobby Guard');
    const [autoPatrol, setAutoPatrol] = useState(false);
    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <ShieldIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Robot Configuration</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Robot Name</Typography>
            <TextField fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
            <Box sx={{ opacity: 0.6 }}>
                <FormControlLabel
                    control={<Switch checked={autoPatrol} onChange={(e) => setAutoPatrol(e.target.checked)} disabled />}
                    label="Enable Auto Patrol" />
                <Typography variant="caption" color="text.disabled" display="block">Coming soon — needs patrol engine</Typography>
            </Box>
        </Paper>
    );
}