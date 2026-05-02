import { Paper, Typography, Box } from '@mui/material';
import type { RobotEvent } from '../../../types/robot';
import EventRow from './EventRow';

interface RecentActivityCardProps {
    events: RobotEvent[];
    loading: boolean;
    error: Error | null;
    max?: number;
}

export default function RecentActivityCard({ 
    events,
    loading,
    error,
    max = 5,
}: RecentActivityCardProps) {
    const visible = events.slice(0, max);

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'gray.200',
            }}
        >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Recent Activity
            </Typography>

            {loading && events.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    Loading events...
                </Typography>
            )}

            {error && events.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    No recent activity
                </Typography>
            )}

            <Box>
                {visible.map((event) => (
                    <EventRow key={event.id} event={event} />
                ))}
            </Box>
        </Paper>
    );
}