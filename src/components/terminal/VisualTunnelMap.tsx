import React from 'react';
import { Shield, ArrowRight, Activity } from 'lucide-react';
import { TunnelConfig } from '../../types/connection';

interface TunnelStats {
    tunnel_id: string;
    bytes_sent: number;
    bytes_received: number;
    is_active: boolean;
}

interface VisualTunnelMapProps {
    tunnels: TunnelConfig[];
    activeTunnels: TunnelConfig[];
    stats: Record<string, TunnelStats>;
}

export const VisualTunnelMap: React.FC<VisualTunnelMapProps> = ({ tunnels, activeTunnels, stats }) => {
    // Helper to format bytes
    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col gap-6 p-6 select-none h-full overflow-y-auto">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Visual Tunnel Map</h3>
            <div className="relative flex flex-col gap-8 pb-12">
                {tunnels.map(tunnel => {
                    const isActive = activeTunnels.some(t => t.id === tunnel.id);
                    const tunnelStats = stats[tunnel.id] || { bytes_sent: 0, bytes_received: 0 };

                    return (
                        <div key={tunnel.id} className="relative group">
                            <div className="flex items-center justify-between gap-12">
                                {/* Local Side */}
                                <div className={`
                                    flex-1 p-4 rounded-xl border transition-all duration-300
                                    ${isActive ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[var(--bg-sidebar)] border-[var(--border-color)] opacity-60'}
                                `}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'}`}>
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-[var(--text-main)] truncate max-w-[120px]">{tunnel.name}</div>
                                            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                                                localhost:{tunnel.local_port}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Link / Animation */}
                                <div className="relative flex items-center justify-center min-w-[200px]">
                                    <div className={`h-[2px] w-full ${isActive ? 'bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-emerald-500/50' : 'bg-[var(--border-color)]'}`} />
                                    {isActive && (
                                        <>
                                            <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 flex items-center gap-4 text-[10px] font-mono whitespace-nowrap bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)]">
                                                <div className="flex items-center gap-1 text-blue-400">
                                                    <ArrowRight size={10} className="rotate-180" />
                                                    {formatBytes(tunnelStats.bytes_sent)}
                                                </div>
                                                <div className="flex items-center gap-1 text-emerald-400">
                                                    {formatBytes(tunnelStats.bytes_received)}
                                                    <ArrowRight size={10} />
                                                </div>
                                            </div>
                                            {/* Pulse effect */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-ping-slow" />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Remote Side */}
                                <div className={`
                                    flex-1 p-4 rounded-xl border transition-all duration-300
                                    ${isActive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[var(--bg-sidebar)] border-[var(--border-color)] opacity-60'}
                                `}>
                                    <div className="flex items-center justify-between">
                                        <div className="text-right">
                                            <div className="font-bold text-[var(--text-main)] truncate max-w-[120px]">
                                                {tunnel.tunnel_type === 'Dynamic' ? 'SOCKS5 Proxy' : (tunnel.remote_host || '127.0.0.1')}
                                            </div>
                                            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                                                {tunnel.tunnel_type === 'Dynamic' ? 'Any Destination' : `port ${tunnel.remote_port}`}
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-lg ml-3 ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'}`}>
                                            <Activity size={18} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes ping-slow {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { opacity: 0.8; }
                    100% { transform: scale(3); opacity: 0; }
                }
                .animate-ping-slow {
                    animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
            `}</style>
        </div>
    );
};
