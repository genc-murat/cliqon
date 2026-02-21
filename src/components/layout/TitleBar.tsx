import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Copy } from 'lucide-react';
import { Logo } from './Logo';

export const TitleBar: React.FC = () => {
    const appWindow = getCurrentWindow();
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateMaximized = async () => {
            setIsMaximized(await appWindow.isMaximized());
        };

        updateMaximized();
        const unlisten = appWindow.onResized(() => {
            updateMaximized();
        });

        return () => {
            unlisten.then(u => u());
        };
    }, []);

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = async () => {
        await appWindow.toggleMaximize();
    };
    const handleClose = () => appWindow.close();

    return (
        <div
            data-tauri-drag-region
            onDoubleClick={handleMaximize}
            className="h-8 w-full bg-[var(--bg-sidebar)] flex items-center justify-between select-none shrink-0 border-b border-[var(--border-color)] cursor-default"
        >
            <div className="flex items-center gap-2 px-3 pointer-events-none" data-tauri-drag-region>
                <Logo size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-0.5">Cliqon</span>
            </div>

            <div className="flex h-full">
                <button
                    onClick={handleMinimize}
                    className="h-full w-10 flex items-center justify-center hover:bg-[var(--hover-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    title="Minimize"
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-full w-10 flex items-center justify-center hover:bg-[var(--hover-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? <Copy size={12} /> : <Square size={12} />}
                </button>
                <button
                    onClick={handleClose}
                    className="h-full w-10 flex items-center justify-center hover:bg-red-500 hover:text-white text-[var(--text-muted)] transition-colors"
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};
