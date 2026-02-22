import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface SessionTimeoutOverlayProps {
    onReconnect: () => void;
}

export const SessionTimeoutOverlay: React.FC<SessionTimeoutOverlayProps> = ({ onReconnect }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                onReconnect();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onReconnect]);

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop with heavy blur and dark overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-500 animate-in fade-in" />

            {/* Content Card */}
            <div className="relative bg-[var(--bg-primary)] border border-red-500/30 rounded-2xl shadow-[0_20px_50px_rgba(255,0,0,0.1)] w-full max-w-lg p-8 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
                </div>

                <h2 className="text-2xl font-black text-[var(--text-main)] mb-2 tracking-tight">
                    Session Locked
                </h2>

                <p className="text-[var(--text-muted)] mb-8 text-sm">
                    For your security, active connections have been closed due to inactivity.
                    Reconnecting will re-establish secure channels.
                </p>

                <div className="flex items-center gap-3">
                    <span className="text-[var(--text-main)] font-medium">Press</span>
                    <div className="px-3 py-1.5 bg-[var(--bg-sidebar)] border border-red-500/30 rounded-lg shadow-inner flex items-center justify-center text-red-400 font-mono font-bold text-lg">
                        R
                    </div>
                    <span className="text-[var(--text-main)] font-medium">to reconnect</span>
                </div>

                <button
                    onClick={onReconnect}
                    className="mt-8 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl text-sm font-bold transition-all active:scale-95"
                >
                    Reconnect Manually
                </button>
            </div>
        </div>
    );
};
