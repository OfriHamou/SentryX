import { useEffect, useState, type RefObject } from 'react';

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    useEffect(() => {
        const handler = () => {
            setIsFullscreen(document.fullscreenElement === ref.current); 
        };
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, [ref]);

    const enterFullscreen = async () => {
        if (!ref.current || document.fullscreenElement) return;
        try {
            await ref.current.requestFullscreen();
        } catch (error) {
            console.warn('Error entering fullscreen:', error);
        }
    };

    const exitFullscreen = async () => {
        if (!document.fullscreenElement) return;
        try {
            await document.exitFullscreen();
        } catch (error) {
            console.warn('Error exiting fullscreen:', error);
        }
    };

    const toggleFullscreen = () => { isFullscreen ? exitFullscreen() : enterFullscreen(); };

    return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen };
}
