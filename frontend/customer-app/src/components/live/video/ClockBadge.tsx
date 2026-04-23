import { useEffect, useState } from 'react';
import VideoOverlay from './VideoOverlay';

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function ClockBadge() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);

    return <VideoOverlay position="top-right">{formatTime(now)}</VideoOverlay>;
}