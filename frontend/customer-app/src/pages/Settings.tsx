import { Box, Typography, Button, Stack } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import RobotConfig from '../components/settings/RobotConfig';
import PatrolSchedule from '../components/settings/PatrolSchedule';
import NotificationsSettings from '../components/settings/NotificationsSettings';
import AuthorizedFaces from '../components/settings/AuthorizedFaces';

export default function Settings() {
    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Settings</Typography>
            <RobotConfig />
            <PatrolSchedule />
            <NotificationsSettings />
            <AuthorizedFaces />
            {/* TODO: persist to backend once a settings endpoint exists */}
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<SaveIcon />} disabled sx={{ textTransform: 'none', borderRadius: 2, px: 4, py: 1.2 }}>
                    Save Settings
                </Button>
            </Stack>
        </Box>
    );
}
