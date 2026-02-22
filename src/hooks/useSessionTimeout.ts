import { useEffect, useState, useRef } from 'react';

export function useSessionTimeout(timeoutMinutes: number) {
    const [isTimedOut, setIsTimedOut] = useState(false);
    const lastActivityRef = useRef(Date.now());

    useEffect(() => {
        // If timeout is 0 or less, feature is disabled
        if (timeoutMinutes <= 0) {
            setIsTimedOut(false);
            return;
        }

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
            // We do NOT automatically un-timeout here on mouse move.
            // Timeout requires explicit 'r' key press to unlock.
        };

        // Listen for user activity
        window.addEventListener('mousemove', updateActivity, { passive: true });
        window.addEventListener('keydown', updateActivity, { passive: true });
        window.addEventListener('click', updateActivity, { passive: true });
        window.addEventListener('wheel', updateActivity, { passive: true });

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastActivityRef.current;

            if (elapsed > timeoutMinutes * 60 * 1000 && !isTimedOut) {
                setIsTimedOut(true);
            }
        }, 10000); // Check every 10 seconds

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
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
