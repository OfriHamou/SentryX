import { Paper, Typography, Stack, Button, Alert } from '@mui/material';
import { Home as DockIcon, PlayArrow as ResumeIcon, Stop as StopIcon, AddLocationAlt as AddLocationIcon } from '@mui/icons-material';

/* TODO: enable + wire onClick once autonomous-nav / patrol backend exists. */
export default function QuickActions() {
    const btnSx = { justifyContent: 'flex-start', textTransform: 'none', borderRadius: 2, py: 1.2 } as const;

     return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quick Actions</Typography>
            <Stack spacing={1.5}>
                <Button startIcon={<DockIcon />} variant="outlined" disabled sx={btnSx}>Return to Charging Dock</Button>
                <Button startIcon={<ResumeIcon />} variant="outlined" disabled sx={btnSx}>Resume Patrol</Button>
                <Button startIcon={<StopIcon />} variant="contained" color="error" disabled sx={btnSx}>Stop Patrol</Button>
                <Button startIcon={<AddLocationIcon />} variant="outlined" color="success" disabled sx={btnSx}>Add specific location</Button>
            </Stack>
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                Patrol &amp; navigation are prepared, pending autonomous-nav on the robot.
            </Alert>
        </Paper>
    );
}