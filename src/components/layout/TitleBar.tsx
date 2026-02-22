import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Radio } from 'lucide-react';
import { Logo } from './Logo';
import { useSharing } from '../../contexts/SharingContext';

export const TitleBar: React.FC = () => {
    const appWindow = getCurrentWindow();
    const { status, togglePanel, pendingShares } = useSharing();

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = async () => {
        await appWindow.toggleMaximize();
    };
    const handleClose = () => appWindow.close();

    return (
        <div
            onDoubleClick={handleMaximize}
            className="h-8 w-full bg-[var(--bg-sidebar)] flex items-center justify-between select-none shrink-0 border-b border-[var(--border-color)] cursor-default"
        >
            <div data-tauri-drag-region className="flex items-center gap-2 px-3 h-full">
                <div className="pointer-events-none flex items-center gap-2">
                    <Logo size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-0.5">Cliqon</span>
                </div>
            </div>

            <div className="flex-1 h-full" data-tauri-drag-region />

            <div className="flex items-center h-full mr-2">
                {status?.active && (
                    <button
                        onClick={togglePanel}
                        className="relative flex items-center justify-center p-1.5 rounded-md hover:bg-[var(--hover-color)] transition-colors group"
                        title="Network Sharing Active"
                    >
                        <Radio size={14} className="text-emerald-500 animate-pulse group-hover:animate-none" />
                        {pendingShares.length > 0 && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-[var(--bg-sidebar)]" />
                        )}
                    </button>
                )}
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
                    title="Toggle Maximize"
                >
                    <Square size={12} />
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
