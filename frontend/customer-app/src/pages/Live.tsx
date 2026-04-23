import { useState, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import VideoPlayer from '../components/live/video/VideoPlayer';
import ActionPanel from '../components/live/actions/ActionPanel';
import DetectionStatusCard from '../components/live/detection/DetectionStatusCard';
import RecentActivityCard from '../components/live/activity/RecentActivityCard';
import { useBattery } from '../hooks/robot/useBattery';
import { useRobot } from '../hooks/robot/useRobot';
import { useDetectionStatus } from '../hooks/robot/useDetectionStatus';
import { useEvents } from '../hooks/robot/useEvents';
import { useFullscreen } from '../hooks/useFullscreen';
import FullscreenControls from '../components/live/fullscreen/FullscreenControls';

export default function Live() {
    const { data: battery } = useBattery();
    const { data: robot } = useRobot();
    const { data: detection } = useDetectionStatus();
    const { data: events, loading: eventsLoading, error: eventsError } = useEvents();
    const [volume, setVolume] = useState(50);
    const fullscreenRef = useRef<HTMLDivElement>(null);
    const { isFullscreen, toggleFullscreen } = useFullscreen(fullscreenRef);

    const faceStatus = detection?.camera_opened ? 'active' : 'inactive';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Live Feed
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {robot ? `${robot.name} - ${robot.location}` : '—'}
                </Typography>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    py: 3,
                    px: 4,
                    borderRadius: 3,
                    bgcolor: 'gray.100',
                    display: 'grid',
                    gridTemplateColumns: '1fr 350px',
                    gap: 5,
                    /* alignItems: 'start', */
                }}
            >
                <Box 
                    ref={fullscreenRef}
                    sx={{ 
                        position: 'relative',
                        bgcolor: isFullscreen ? 'black' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',

                        '&:fullscreen': {
                            width: '100vw',
                            height: '100vh',
                        },

                        '&:fullscreen > :first-of-type': {
                            width: '100vw',
                            height: '100vh',
                            maxHeight: 'none',
                            aspectRatio: 'unset',
                            borderRadius: 0,
                        },
                    }}
                >
                    <VideoPlayer
                        location={robot?.location ?? '—'}
                        batteryStatus={battery?.status ?? null}
                        batteryVoltage={battery?.voltage ?? null}
                        onFullscreenToggle={toggleFullscreen}
                    />

                    {isFullscreen && (<FullscreenControls 
                        onExitFullscreen={toggleFullscreen}
                        onAlarm={() => console.log('alarm triggered')}
                        onCallEmergency={() => console.log('emergency call triggered')}
                        onTalkToggle={(talking) => console.log('talk toggle', talking)}
                        />
                    )}
                </Box>


                <ActionPanel
                        onTalkToggle={(talking) => console.log('talk toggle', talking)}
                        onAlarm={() => console.log('alarm triggered')}
                        onCallEmergency={() => console.log('emergency call triggered')}
                        volume={volume}
                        onVolumeChange={setVolume}
                />
            </Paper>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 3,
                }}
            >
                <DetectionStatusCard faceRecognitionStatus={faceStatus} />
                <RecentActivityCard
                      events={events ?? []}
                      loading={eventsLoading}
                      error={eventsError}
                />
            </Box>
        </Box>
    );    
}