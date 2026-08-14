import { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Dialog,
    Chip,
    Stack,
    Select,
    MenuItem,
    TextField,
    FormControl,
    Button,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import { useEventHistory } from '../hooks/robot/useEventHistory';
import {
    eventDbImageUrl,
    deleteEvent,
    deleteAllEvents,
} from '../api/robot';
import { getEventDisplay } from '../components/live/activity/eventRegistry';
import type { RobotEvent } from '../types/robot';

type TimeRange = '24h' | 'week' | 'month' | 'custom';

const RANGE_MS: Record<'24h' | 'week' | 'month', number> = {
    '24h': 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function MediaGallery() {
    const { data: events, refresh } = useEventHistory();

    const [selected, setSelected] = useState<RobotEvent | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Captured on range change, not during render,
    // so the window stays stable while polling.
    const [cutoff, setCutoff] = useState(
        () => Date.now() - RANGE_MS['month']
    );

    const changeTimeRange = (next: TimeRange) => {
        setTimeRange(next);

        if (next !== 'custom') {
            setCutoff(Date.now() - RANGE_MS[next]);
        }
    };

    const inTimeRange = (ts: string) => {
        const t = new Date(ts).getTime();

        if (timeRange === 'custom') {
            const from = customFrom
                ? new Date(customFrom).getTime()
                : -Infinity;

            const to = customTo
                ? new Date(customTo).getTime() + DAY_MS
                : Infinity;

            return t >= from && t <= to;
        }

        return t >= cutoff;
    };

    const withImages = (events ?? []).filter(
        (e) => e.image_filename && inTimeRange(e.timestamp)
    );

    const handleDeleteEvent = async (eventId: string) => {
        const confirmed = window.confirm(
            'Delete this event permanently? This cannot be undone.'
        );

        if (!confirmed) return;

        try {
            setDeleting(true);

            await deleteEvent(eventId);

            if (selected?.id === eventId) {
                setSelected(null);
            }

            await refresh();
        } catch (error) {
            console.error('Failed to delete event:', error);
            window.alert('Failed to delete event.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteAll = async () => {
        const confirmed = window.confirm(
            'Delete ALL events permanently? This cannot be undone.'
        );

        if (!confirmed) return;

        try {
            setDeleting(true);

            await deleteAllEvents();

            setSelected(null);

            await refresh();
        } catch (error) {
            console.error('Failed to delete all events:', error);
            window.alert('Failed to delete all events.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Box>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{
                    justifyContent: 'space-between',
                    alignItems: { sm: 'center' },
                    mb: 3,
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Media Gallery
                </Typography>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                >
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                        <Select
                            value={timeRange}
                            onChange={(e) =>
                                changeTimeRange(
                                    e.target.value as TimeRange
                                )
                            }
                            sx={{
                                bgcolor: '#fff',
                                borderRadius: 2,
                            }}
                        >
                            <MenuItem value="24h">
                                Last 24 hours
                            </MenuItem>

                            <MenuItem value="week">
                                Last week
                            </MenuItem>

                            <MenuItem value="month">
                                Last month
                            </MenuItem>

                            <MenuItem value="custom">
                                Custom
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        disabled={
                            deleting ||
                            (events?.length ?? 0) === 0
                        }
                        onClick={() => void handleDeleteAll()}
                    >
                        Delete All Events
                    </Button>
                </Stack>
            </Stack>

            {timeRange === 'custom' && (
                <Stack
                    direction="row"
                    spacing={2}
                    sx={{ mb: 3 }}
                >
                    <TextField
                        type="date"
                        size="small"
                        label="From"
                        value={customFrom}
                        onChange={(e) =>
                            setCustomFrom(e.target.value)
                        }
                        slotProps={{
                            inputLabel: { shrink: true },
                        }}
                        sx={{
                            bgcolor: '#fff',
                            borderRadius: 2,
                        }}
                    />

                    <TextField
                        type="date"
                        size="small"
                        label="To"
                        value={customTo}
                        onChange={(e) =>
                            setCustomTo(e.target.value)
                        }
                        slotProps={{
                            inputLabel: { shrink: true },
                        }}
                        sx={{
                            bgcolor: '#fff',
                            borderRadius: 2,
                        }}
                    />
                </Stack>
            )}

            {withImages.length === 0 ? (
                <Typography color="text.secondary">
                    No frames captured yet
                </Typography>
            ) : (
                <Grid container spacing={2}>
                    {withImages.map((e) => {
                        const display = getEventDisplay(e);

                        return (
                            <Grid
                                size={{ xs: 6, sm: 4, md: 3 }}
                                key={e.id}
                            >
                                <Paper
                                    elevation={0}
                                    onClick={() => setSelected(e)}
                                    sx={{
                                        position: 'relative',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        borderColor: 'grey.200',
                                        '&:hover': {
                                            boxShadow: 3,
                                        },
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        color="error"
                                        disabled={deleting}
                                        onClick={(event) => {
                                            event.stopPropagation();

                                            void handleDeleteEvent(
                                                e.id
                                            );
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            zIndex: 2,
                                            bgcolor: 'white',
                                            boxShadow: 1,
                                            '&:hover': {
                                                bgcolor: 'grey.100',
                                            },
                                        }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>

                                    <Box
                                        component="img"
                                        src={eventDbImageUrl(e.id)}
                                        alt={display.title(e)}
                                        sx={{
                                            width: '100%',
                                            height: 140,
                                            objectFit: 'cover',
                                            display: 'block',
                                            bgcolor: 'grey.100',
                                        }}
                                    />

                                    <Box sx={{ p: 1 }}>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 600,
                                                display: 'block',
                                                whiteSpace:
                                                    'nowrap',
                                                overflow:
                                                    'hidden',
                                                textOverflow:
                                                    'ellipsis',
                                            }}
                                        >
                                            {display.title(e)}
                                        </Typography>

                                        <Typography
                                            variant="caption"
                                            color="text.disabled"
                                        >
                                            {new Date(
                                                e.timestamp
                                            ).toLocaleString()}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            <Dialog
                open={!!selected}
                onClose={() => setSelected(null)}
                maxWidth="md"
            >
                {selected && (
                    <Box>
                        <Box
                            component="img"
                            src={eventDbImageUrl(selected.id)}
                            alt=""
                            sx={{
                                width: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain',
                                display: 'block',
                                bgcolor: 'black',
                            }}
                        />

                        <Stack
                            direction="row"
                            spacing={2}
                            sx={{
                                p: 2,
                                alignItems: 'center',
                            }}
                        >
                            <Typography sx={{ fontWeight: 700 }}>
                                {getEventDisplay(
                                    selected
                                ).title(selected)}
                            </Typography>

                            {selected.is_alert && (
                                <Chip
                                    label="Alert"
                                    size="small"
                                    color="error"
                                />
                            )}

                            <Box sx={{ flexGrow: 1 }} />

                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {new Date(
                                    selected.timestamp
                                ).toLocaleString()}
                            </Typography>

                            <Button
                                color="error"
                                size="small"
                                startIcon={<DeleteIcon />}
                                disabled={deleting}
                                onClick={() =>
                                    void handleDeleteEvent(
                                        selected.id
                                    )
                                }
                            >
                                Delete
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Dialog>
        </Box>
    );
}