import { useRef, useState } from 'react';    
import { Alert, Box, Paper, Typography, Stack, Slider, Button, Select, MenuItem, FormControl, Grid, IconButton } from '@mui/material'; 
import { Videocam as CameraIcon, TipsAndUpdates as TipsIcon, Fullscreen as FullscreenIcon } from '@mui/icons-material'; 
import { useFullscreen } from '../../hooks/useFullscreen';
import JoystickControl from '../live/JoystickControl';
import { useRobotMove } from '../../hooks/robot/useRobotMove';
import { videoStreamUrl } from '../../api/robot';
import type { MoveInput } from '../../types/robot';

interface MovementControlsProps {
    canWrite: boolean;
}

export default function MovementControls({ canWrite }: MovementControlsProps) {
    const { move, stop } = useRobotMove();
    const [speed, setSpeed] = useState(50);
    const videoRef = useRef<HTMLDivElement>(null);
    const { toggleFullscreen } = useFullscreen(videoRef);
    const [videoError, setVideoError] = useState(false);

    // speed slider scales the joystick output (real)
    const handleMove = (input: MoveInput) => {
        const factor = speed / 100;
        move({ speed: input.speed * factor, rotation: input.rotation * factor });
    };

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Movement Controls</Typography>
            {!canWrite && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                    Read-only control access
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Left: camera feed + joystick */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box ref={videoRef} sx={{
                        position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#1F2433',
                        aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
                        '&:fullscreen': { aspectRatio: 'unset', width: '100vw', height: '100vh', borderRadius: 0 },
                    }}>
                        {videoError ? (
                            <Stack sx={{ alignItems: 'center', color: 'grey.500' }}>
                                <CameraIcon />
                                <Typography variant="caption">Camera feed unavailable</Typography>
                            </Stack>
                        ) : (
                            <>
                                <Box component="img" src={videoStreamUrl()} alt="Live camera"
                                    onError={() => setVideoError(true)}
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <IconButton onClick={toggleFullscreen} size="small"
                                    sx={{ position: 'absolute', bottom: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}>
                                    <FullscreenIcon fontSize="small" />
                                </IconButton>
                            </>
                        )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Directional Control</Typography>
                    {canWrite && <JoystickControl size={150} onMove={handleMove} onStop={stop} />}
                </Grid>

                {/* Right: speed + go-to-location + tips */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ mb: 3 }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Speed</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{speed}%</Typography>
                        </Stack>
                        <Slider value={speed} onChange={(_, v) => setSpeed(v as number)} min={0} max={100} disabled={!canWrite} />
                    </Box>

                    {/* Go to location — PREPARED, needs autonomous nav */}
                    <Box sx={{ mb: 3, opacity: 0.6 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Go to location</Typography>
                        <Stack spacing={1}>
                            <FormControl size="small" fullWidth disabled>
                                <Select value="" displayEmpty><MenuItem value="">Select a location…</MenuItem></Select>
                            </FormControl>
                            <Button variant="outlined" disabled fullWidth>Go to Location</Button>
                        </Stack>
                        <Typography variant="caption" color="text.disabled">Coming soon — needs autonomous navigation</Typography>
                    </Box>

                    {/* Navigation tips */}
                    <Box sx={{ bgcolor: '#EEF0FB', borderRadius: 2, p: 2 }}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1, color: 'primary.dark' }}>
                            <TipsIcon sx={{ fontSize: 18 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Navigation Tips</Typography>
                        </Stack>
                        <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
                            <li><Typography variant="caption" color="text.secondary">Use the joystick for precise movements</Typography></li>
                            <li><Typography variant="caption" color="text.secondary">Speed caps the robot's max velocity</Typography></li>
                            <li><Typography variant="caption" color="text.secondary">Monitor battery during manual operation</Typography></li>
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </Paper>
    );
}
