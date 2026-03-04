import React, { useEffect } from 'react';
import { Lock, Activity } from 'lucide-react';

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
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden">
            {/* Immersive Deep Blur Background */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-all duration-700 animate-in fade-in" />

            {/* Subtle background ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--accent-color)] opacity-[0.15] blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-[210] flex flex-col items-center animate-in fade-in zoom-in-95 duration-700 w-full max-w-lg">

                {/* Visual Security Core (Animated Lock) */}
                <div className="relative flex items-center justify-center w-32 h-32 mb-10">
                    {/* Pulsing Concentric Rings */}
                    <div className="absolute inset-0 border border-[var(--accent-color)] opacity-40 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <div className="absolute inset-2 border border-[var(--accent-color)] opacity-20 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />

                    {/* Solid Core Ring */}
                    <div className="absolute inset-4 border border-[var(--accent-color)] opacity-30 rounded-full animate-pulse" />

                    {/* Glowing Center Lock */}
                    <div className="relative z-10 flex items-center justify-center w-20 h-20 bg-[var(--bg-primary)] rounded-full border border-[var(--border-color)] shadow-[0_0_25px_var(--accent-color)]">
                        <Lock className="w-8 h-8 text-[var(--accent-color)]" strokeWidth={1.2} />
                    </div>
                </div>

                {/* Cyber/Terminal Themed Typography */}
                <div className="text-center mb-10 select-none">
                    <h2 className="text-3xl font-light text-white mb-3 tracking-[0.25em] uppercase">
                        Session <span className="font-bold text-[var(--accent-color)]">Locked</span>
                    </h2>
                    <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide">
                        Terminal activity suspended to preserve security integrities.
                    </p>
                </div>

                {/* Interactive Action Area */}
                <div className="flex flex-col items-center gap-8 w-full">
                    {/* Premium Glass Reconnect Button */}
                    <button
                        onClick={onReconnect}
                        className="group relative flex items-center justify-center gap-3 px-10 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[var(--accent-color)] rounded-full text-white font-medium transition-all duration-500 overflow-hidden active:scale-95 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_var(--accent-color)]"
                    >
                        {/* Smooth Light Sweep Animation */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-out" />

                        <Activity className="w-4 h-4 text-[var(--accent-color)] group-hover:animate-pulse" />
                        <span className="relative z-10 tracking-wider text-sm">Initialize Reconnection</span>
                    </button>

                    {/* Keyboard Shortcut Indicator */}
                    <div className="flex items-center gap-4 text-xs text-white/40">
                        <div className="w-12 h-px bg-white/10" />
                        <span className="uppercase tracking-[0.2em] text-[10px]">or press</span>
                        <kbd className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-white/70 font-mono shadow-sm flex items-center justify-center">
                            R
                        </kbd>
                        <div className="w-12 h-px bg-white/10" />
                    </div>

                    {/* Close Link */}
                    <button
                        onClick={onClose}
                        className="mt-2 text-[10px] text-white/30 hover:text-white/60 tracking-widest uppercase transition-colors underline underline-offset-4 decoration-white/20"
                    >
                        Dismiss Overlay (Esc)
                    </button>
                </div>
            </div>
        </div>
    );
};
