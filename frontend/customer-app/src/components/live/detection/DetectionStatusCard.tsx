import { Paper, Typography } from '@mui/material';
import {
    Face as FaceIcon,
    Cloud as SmokeIcon,
    LocalFireDepartment as FireIcon,
    DirectionsRun as MotionIcon,
} from '@mui/icons-material';
import DetectorRow from './DetectorRow';
import type { DetectorStatus } from './StatusPill';

interface DetectionStatusCardProps {
    faceRecognitionStatus: DetectorStatus;
}

export default function DetectionStatusCard({ faceRecognitionStatus }: DetectionStatusCardProps) {
    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'grey.200',
            }}
        >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Detection Status
            </Typography>

            <DetectorRow name="Face Recognition" icon={<FaceIcon />} status={faceRecognitionStatus} />
            <DetectorRow name="Smoke Detection" icon={<SmokeIcon />} status="unavailable" />
            <DetectorRow name="Fire Detection" icon={<FireIcon />} status="unavailable" />
            <DetectorRow name="Motion Detection" icon={<MotionIcon />} status="unavailable" />
        </Paper>
    );
}
