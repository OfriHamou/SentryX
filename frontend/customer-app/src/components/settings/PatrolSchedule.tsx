import { Paper, Typography, Stack, Switch, Button, Box } from '@mui/material';
import { Schedule as ScheduleIcon, Add as AddIcon } from '@mui/icons-material';

const SCHEDULES = [
    { label: 'Sunday–Thursday', time: '08:00 – 22:00', enabled: true },
    { label: 'Friday–Saturday', time: '08:00 – 22:00', enabled: false },
];

interface PatrolScheduleProps {
    canWrite: boolean;
}

export default function PatrolSchedule({ canWrite }: PatrolScheduleProps) {
    const patrolScheduleEnabled = false;

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', mb: 3, opacity: 0.6 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <ScheduleIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Patrol Schedule</Typography>
            </Stack>
            <Typography variant="caption" color="text.disabled" sx={{ mb: 2, display: 'block' }}>Coming soon — needs patrol engine</Typography>
            <Stack spacing={1}>
                {SCHEDULES.map((s) => (
                    <Box key={s.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.5 }}>
                        <Box>
                            <Typography sx={{ fontWeight: 600 }}>{s.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{s.time}</Typography>
                        </Box>
                        <Switch defaultChecked={s.enabled} disabled />
                    </Box>
                ))}
            </Stack>
            <Button startIcon={<AddIcon />} disabled={!canWrite || !patrolScheduleEnabled} fullWidth sx={{ mt: 1.5, textTransform: 'none', border: '1px dashed', borderColor: 'grey.300', borderRadius: 2 }}>
                Add Schedule
            </Button>
        </Paper>
    );
}
