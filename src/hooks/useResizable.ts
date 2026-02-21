import { useState, useEffect, useRef, useCallback } from 'react';

export function useResizable(defaultWidth: number, minWidth: number, maxWidth: number, direction: 'left' | 'right' = 'left') {
    const [width, setWidth] = useState(defaultWidth);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef({ startX: 0, startWidth: 0 });

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeRef.current = {
            startX: e.clientX,
            startWidth: width,
        };
    }, [width]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const { startX, startWidth } = resizeRef.current;
            const delta = e.clientX - startX;
            // If the handle is on the left side of a right-anchored panel, dragging left (negative delta) means increasing width
            const newWidth = direction === 'left'
                ? Math.min(Math.max(startWidth + delta, minWidth), maxWidth)
                : Math.min(Math.max(startWidth - delta, minWidth), maxWidth);
            setWidth(newWidth);
            // Fire a custom event to force xterm to resize since the container changes
            window.dispatchEvent(new Event('resize'));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, minWidth, maxWidth, direction]);

    return { width, startResizing, isResizing };
}
