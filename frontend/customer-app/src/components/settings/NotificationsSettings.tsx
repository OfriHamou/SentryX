import { useState } from 'react';
import { Paper, Typography, Stack, Switch, Box } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';

interface NotificationsSettingsProps {
    canWrite: boolean;
}

export default function NotificationsSettings({ canWrite }: NotificationsSettingsProps) {
    const [push, setPush] = useState(true);
    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <NotificationsIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Notifications</Typography>
            </Stack>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography sx={{ fontWeight: 600 }}>Push Notifications</Typography>
                    <Typography variant="caption" color="text.secondary">Receive alerts on your device</Typography>
                </Box>
                <Switch checked={push} onChange={(e) => setPush(e.target.checked)} disabled={!canWrite} />
            </Box>
        </Paper>
    );
}
