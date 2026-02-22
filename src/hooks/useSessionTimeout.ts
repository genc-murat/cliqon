import { useEffect, useState, useRef } from 'react';

export function useSessionTimeout(timeoutMinutes: number) {
    const [isTimedOut, setIsTimedOut] = useState(false);
    const lastActivityRef = useRef(Date.now());
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // If timeout is 0 or less, feature is disabled
        if (timeoutMinutes <= 0) {
            setIsTimedOut(false);
            return;
        }

        const updateActivity = (e?: Event) => {
            // Special handling for mousemove to ignore sensor noise/jitter
            if (e instanceof MouseEvent && e.type === 'mousemove') {
                if (e.clientX === lastMousePosRef.current.x && e.clientY === lastMousePosRef.current.y) {
                    return; // Mouse didn't actually move (jitter/ghost event)
                }
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }

            lastActivityRef.current = Date.now();
        };

        // Listen for user activity
        window.addEventListener('mousemove', updateActivity, { passive: true });
        window.addEventListener('keydown', updateActivity, { passive: true });
        window.addEventListener('mousedown', updateActivity, { passive: true });
        window.addEventListener('click', updateActivity, { passive: true });
        window.addEventListener('wheel', updateActivity, { passive: true });

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastActivityRef.current;

            if (elapsed > timeoutMinutes * 60 * 1000 && !isTimedOut) {
                console.log(`[SessionTimeout] Triggered after ${Math.round(elapsed / 1000)}s of inactivity`);
                setIsTimedOut(true);
            }
        }, 10000); // Check every 10 seconds

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('mousedown', updateActivity);
            window.removeEventListener('click', updateActivity);
            window.removeEventListener('wheel', updateActivity);
            clearInterval(interval);
        };
    }, [timeoutMinutes, isTimedOut]);

    const resetTimeout = () => {
        lastActivityRef.current = Date.now();
        setIsTimedOut(false);
    };

    return { isTimedOut, resetTimeout };
}
