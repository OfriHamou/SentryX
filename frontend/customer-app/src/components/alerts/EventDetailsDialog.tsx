import { useEffect, useState } from 'react';
import {
    Box,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Stack,
    Typography,
} from '@mui/material';
import type { RobotEvent } from '../../types/robot';
import { fetchEventImageObjectUrl } from '../../api/robot';
import { getEventDisplay } from '../live/activity/eventRegistry';

interface EventDetailsDialogProps {
    event: RobotEvent | null;
    open: boolean;
    location: string;
    onClose: () => void;
}

export default function EventDetailsDialog({ event, open, location, onClose }: EventDetailsDialogProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(false);

    useEffect(() => {
        if (!open || !event) {
            setImageUrl((previous) => {
                if (previous) {
                    URL.revokeObjectURL(previous);
                }
                return null;
            });
            setImageError(null);
            return;
        }

        let active = true;
        let objectUrl: string | null = null;

        setLoadingImage(true);
        setImageError(null);

        fetchEventImageObjectUrl(event.id)
            .then((url) => {
                if (!active) {
                    URL.revokeObjectURL(url);
                    return;
                }
                objectUrl = url;
                setImageUrl(url);
            })
            .catch(() => {
                if (active) {
                    setImageError('No image available for this event');
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingImage(false);
                }
            });

        return () => {
            active = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [event, open]);

    if (!event) {
        return null;
    }

    const display = getEventDisplay(event);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{display.title(event)}</DialogTitle>
            <DialogContent>
                <Stack spacing={2.5} sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        <Chip label={location} size="small" />
                        <Chip label={new Date(event.timestamp).toLocaleString()} size="small" />
                        {event.status ? <Chip label={`Status: ${event.status}`} size="small" /> : null}
                    </Stack>

                    <Box
                        sx={{
                            minHeight: 280,
                            borderRadius: 2,
                            bgcolor: 'grey.100',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                        }}
                    >
                        {imageUrl ? (
                            <Box
                                component="img"
                                src={imageUrl}
                                alt={display.title(event)}
                                sx={{ width: '100%', maxHeight: 420, objectFit: 'contain' }}
                            />
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {loadingImage ? 'Loading event image…' : imageError ?? 'No image available'}
                            </Typography>
                        )}
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                            Detections
                        </Typography>
                        {event.detections?.length ? (
                            <Stack spacing={1}>
                                {event.detections.map((detection, index) => (
                                    <Box key={`${event.id}-${index}`} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.100' }}>
                                        <Typography variant="body2">
                                            {detection.is_known ? detection.name : 'Unknown person'}
                                            {` · confidence ${detection.confidence}%`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {`x:${detection.x}, y:${detection.y}, w:${detection.w}, h:${detection.h}`}
                                        </Typography>
                                    </Box>
                                ))}
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No detection metadata saved for this event.
                            </Typography>
                        )}
                    </Box>

                    {event.source ? (
                        <Typography variant="caption" color="text.secondary">
                            Source: {event.source}
                        </Typography>
                    ) : null}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}