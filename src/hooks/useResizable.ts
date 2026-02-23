import { useState, useEffect, useRef, useCallback } from 'react';
import { storage } from '../lib/storage';

export type ResizeDirection = 'left' | 'right' | 'top' | 'bottom';

export function useResizable(
    defaultSize: number,
    minSize: number,
    maxSize: number,
    direction: ResizeDirection = 'left',
    storageKey?: string
) {
    const isVertical = direction === 'top' || direction === 'bottom';

    const [size, setSize] = useState(defaultSize);
    const [isResizing, setIsResizing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const resizeRef = useRef({ startPos: 0, startSize: 0 });

    useEffect(() => {
        if (!storageKey) {
            setIsLoaded(true);
            return;
        }
        
        if (storage.isInitialized()) {
            const saved = storage.getCached<number>(storageKey, defaultSize);
            setSize(saved);
            setIsLoaded(true);
        } else {
            storage.initialize().then(() => {
                const saved = storage.getCached<number>(storageKey, defaultSize);
                setSize(saved);
                setIsLoaded(true);
            });
        }
    }, [storageKey, defaultSize]);

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
                storage.set(storageKey, clampedSize);
            }

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
        size: isLoaded ? size : defaultSize,
        width: isVertical ? undefined : (isLoaded ? size : defaultSize),
        height: isVertical ? (isLoaded ? size : defaultSize) : undefined,
        startResizing,
        isResizing,
        isLoaded
    };
}
