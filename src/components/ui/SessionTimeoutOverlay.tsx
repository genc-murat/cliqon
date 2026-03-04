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
            {/* Minimal backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-500 animate-in fade-in" />

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-[210] p-2 text-white/40 hover:text-white transition-colors duration-200"
                title="Close Tab (Esc)"
            >
                <X className="w-5 h-5" />
            </button>

            {/* Minimal Content */}
            <div className="relative z-[210] flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-400">
                <div className="mb-6 flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white/60">
                    <Lock className="w-5 h-5" strokeWidth={1.5} />
                </div>

                <h2 className="text-xl font-medium text-white/90 mb-2 tracking-wide">
                    Session Locked
                </h2>

                <p className="text-white/50 mb-8 text-sm max-w-xs font-light">
                    Connection paused due to inactivity.
                </p>

                <div className="flex flex-col items-center gap-5">
                    <button
                        onClick={onReconnect}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors duration-200 backdrop-blur-md"
                    >
                        Reconnect
                    </button>

                    <div className="flex items-center gap-2 text-[11px] text-white/30 uppercase tracking-widest">
                        <span>Press</span>
                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/50 font-sans font-medium">R</kbd>
                        <span>to resume</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
