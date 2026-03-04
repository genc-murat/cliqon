import React, { useEffect } from 'react';
import { Lock, X } from 'lucide-react';

interface SessionTimeoutOverlayProps {
    onReconnect: () => void;
    onClose: () => void;
}

export const SessionTimeoutOverlay: React.FC<SessionTimeoutOverlayProps> = ({ onReconnect, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                onReconnect();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onReconnect, onClose]);

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-4">
            {/* Theme-compatible darker blur behind the card */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md transition-all duration-500 animate-in fade-in" />

            {/* Content Card with App Theme colors */}
            <div className="relative z-[210] flex flex-col items-center text-center p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl animate-in fade-in zoom-in-95 duration-400 w-full max-w-sm">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-full transition-all duration-200"
                    title="Close Tab (Esc)"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6 flex items-center justify-center w-14 h-14 rounded-full bg-[var(--hover-color)] border border-[var(--border-color)] text-[var(--text-main)] shadow-inner">
                    <Lock className="w-6 h-6 opacity-80" strokeWidth={1.5} />
                </div>

                <h2 className="text-xl font-semibold text-[var(--text-main)] mb-2 tracking-wide">
                    Session Locked
                </h2>

                <p className="text-[var(--text-muted)] mb-8 text-sm leading-relaxed px-2">
                    Connection suspended due to inactivity.
                </p>

                <div className="flex flex-col items-center gap-4 w-full">
                    <button
                        onClick={onReconnect}
                        className="w-full py-2.5 bg-[var(--accent-color)] hover:opacity-90 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-[var(--accent-color)]/20 active:scale-[0.98]"
                    >
                        Reconnect Now
                    </button>

                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-2">
                        <span>Press</span>
                        <kbd className="px-2 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-sm text-[var(--text-main)] font-mono font-medium">
                            R
                        </kbd>
                        <span>to resume</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
