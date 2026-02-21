import { useState, useEffect, useRef, useCallback } from 'react';

export type ResizeDirection = 'left' | 'right' | 'top' | 'bottom';

export function useResizable(
    defaultSize: number,
    minSize: number,
    maxSize: number,
    direction: ResizeDirection = 'left',
    storageKey?: string
) {
    const isVertical = direction === 'top' || direction === 'bottom';

    const [size, setSize] = useState(() => {
        if (storageKey) {
            const saved = localStorage.getItem(storageKey);
            if (saved) return parseInt(saved, 10);
        }
        return defaultSize;
    });

    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef({ startPos: 0, startSize: 0 });

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeRef.current = {
            startPos: isVertical ? e.clientY : e.clientX,
            startSize: size,
        };
    }, [size, isVertical]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const { startPos, startSize } = resizeRef.current;
            const delta = (isVertical ? e.clientY : e.clientX) - startPos;

            let newSize = startSize;
            if (direction === 'left') newSize = startSize + delta;
            else if (direction === 'right') newSize = startSize - delta;
            else if (direction === 'bottom') newSize = startSize + delta;
            else if (direction === 'top') newSize = startSize - delta;

            const clampedSize = Math.min(Math.max(newSize, minSize), maxSize);
            setSize(clampedSize);

            if (storageKey) {
                localStorage.setItem(storageKey, clampedSize.toString());
            }

            // Fire a custom event to force xterm/layout to resize
            window.dispatchEvent(new Event('resize'));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, minSize, maxSize, direction, isVertical, storageKey]);

    return {
        size,
        width: isVertical ? undefined : size,
        height: isVertical ? size : undefined,
        startResizing,
        isResizing
    };
}
