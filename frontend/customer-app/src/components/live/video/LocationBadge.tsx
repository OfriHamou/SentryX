import VideoOverlay from './VideoOverlay';

interface LocationBadgeProps {
    text: string;
}

export default function LocationBadge({ text }: LocationBadgeProps) {
    return <VideoOverlay position="top-left">{text}</VideoOverlay>;
}