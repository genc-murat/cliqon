import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Shield, Play, Square, Plus, Trash2, Edit, LayoutList, Share2 } from 'lucide-react';
import { SshProfile, TunnelConfig } from '../../types/connection';
import { TunnelConfigModal } from './TunnelConfigModal';
import { VisualTunnelMap } from './VisualTunnelMap';
interface TunnelManagerProps {
    profile: SshProfile;
    sessionId: string;
}

export const TunnelManager: React.FC<TunnelManagerProps> = ({ profile, sessionId }) => {
    const [activeTunnels, setActiveTunnels] = useState<TunnelConfig[]>([]);
    const [tunnelStats, setTunnelStats] = useState<Record<string, any>>({});
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTunnel, setEditingTunnel] = useState<TunnelConfig | undefined>();

    const configuredTunnels = profile.tunnels || [];

    const fetchActiveTunnels = async () => {
        try {
            const tunnels: TunnelConfig[] = await invoke('get_active_tunnels', { sessionId });
            setActiveTunnels(tunnels);

            const stats: any[] = await invoke('get_tunnel_stats', { sessionId });
            const statsMap: Record<string, any> = {};
            stats.forEach(s => {
                statsMap[s.tunnel_id] = s;
            });
            setTunnelStats(statsMap);
        } catch (err: any) {
            console.error('Failed to get active tunnels or stats:', err);
        }
    };

    useEffect(() => {
        fetchActiveTunnels();
        const interval = setInterval(fetchActiveTunnels, 2000);
        return () => clearInterval(interval);
    }, [sessionId]);

    const handleSaveTunnel = async (config: TunnelConfig) => {
        try {
            const updatedTunnels = editingTunnel
                ? configuredTunnels.map(t => t.id === config.id ? config : t)
                : [...configuredTunnels, config];

            const updatedProfile = { ...profile, tunnels: updatedTunnels };
            await invoke('save_profile', { profile: updatedProfile });

            // To immediately reflect the change:
            profile.tunnels = updatedTunnels;
            setIsModalOpen(false);
            setEditingTunnel(undefined);
        } catch (err: any) {
            throw new Error(`Failed to save tunnel: ${err.toString()}`);
        }
    };

    const handleDeleteTunnel = async (tunnelId: string) => {
        if (!confirm('Are you sure you want to delete this tunnel?')) return;

        try {
            if (isTunnelActive(tunnelId)) {
                await invoke('stop_tunnel', { tunnelId });
                await fetchActiveTunnels();
            }

            const updatedTunnels = configuredTunnels.filter(t => t.id !== tunnelId);
            const updatedProfile = { ...profile, tunnels: updatedTunnels };
            await invoke('save_profile', { profile: updatedProfile });

            profile.tunnels = updatedTunnels;
        } catch (err: any) {
            setError(err.toString());
        }
    }

    const isTunnelActive = (tunnelId: string) => {
        return activeTunnels.some(t => t.id === tunnelId);
    };
    const handleToggleTunnel = async (tunnel: TunnelConfig) => {
        setLoading(true);
        setError(null);
        try {
            if (isTunnelActive(tunnel.id)) {
                await invoke('stop_tunnel', { tunnelId: tunnel.id });
            } else {
                await invoke('start_tunnel', { sessionId, config: tunnel });
            }
            await fetchActiveTunnels();
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] border-l border-[var(--border-color)]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
                        <Shield className="text-[var(--accent-color)]" size={18} />
                        SSH Tunnels
                    </div>
                    <div className="flex items-center bg-[var(--bg-sidebar)] p-1 rounded-lg border border-[var(--border-color)]">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1 rounded ${viewMode === 'list' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                            title="List View"
                        >
                            <LayoutList size={14} />
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`p-1 rounded ${viewMode === 'map' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                            title="Visual Map"
                        >
                            <Share2 size={14} />
                        </button>
                    </div>
                </div>
                <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[var(--accent-color)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
                    onClick={() => {
                        setEditingTunnel(undefined);
                        setIsModalOpen(true);
                    }}
                >
                    <Plus size={14} />
                    Add Tunnel
                </button>
            </div>

            {error && (
                <div className="mx-4 mt-4 p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {viewMode === 'map' ? (
                    <VisualTunnelMap
                        tunnels={configuredTunnels}
                        activeTunnels={activeTunnels}
                        stats={tunnelStats}
                    />
                ) : (
                    <div className="p-4">
                        {configuredTunnels.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] py-12">
                                <Shield size={48} className="mb-4 opacity-20" />
                                <p>No tunnels configured for this profile.</p>
                                <p className="text-sm mt-1">Click "Add Tunnel" to create one.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {configuredTunnels.map(tunnel => {
                                    const active = isTunnelActive(tunnel.id);

                                    return (
                                        <div
                                            key={tunnel.id}
                                            className={`
                                                flex items-center justify-between p-3 rounded-lg border transition-colors
                                                ${active
                                                    ? 'bg-green-500/5 border-green-500/20'
                                                    : 'bg-[var(--bg-sidebar)] border-[var(--border-color)]'}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handleToggleTunnel(tunnel)}
                                                    disabled={loading}
                                                    className={`
                                                        p-2 rounded-full transition-colors
                                                        ${active
                                                            ? 'text-red-400 hover:bg-red-400/20'
                                                            : 'text-green-400 hover:bg-green-400/20'}
                                                        ${loading && 'opacity-50 cursor-not-allowed'}
                                                    `}
                                                    title={active ? 'Stop Tunnel' : 'Start Tunnel'}
                                                >
                                                    {active ? <Square size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
                                                </button>

                                                <div>
                                                    <div className="font-medium text-[var(--text-main)] text-sm flex items-center gap-2">
                                                        {tunnel.name}
                                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                                            {tunnel.tunnel_type}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                                                        {tunnel.tunnel_type === 'Local' && (
                                                            <>127.0.0.1:{tunnel.local_port} → {tunnel.remote_host || '127.0.0.1'}:{tunnel.remote_port}</>
                                                        )}
                                                        {tunnel.tunnel_type === 'Remote' && (
                                                            <span className="text-yellow-500/70">Remote Forwarding</span>
                                                        )}
                                                        {tunnel.tunnel_type === 'Dynamic' && (
                                                            <span className="text-yellow-500/70">SOCKS5 Proxy</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-md transition-colors"
                                                    onClick={() => {
                                                        setEditingTunnel(tunnel);
                                                        setIsModalOpen(true);
                                                    }}
                                                    title="Edit Tunnel"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                                    onClick={() => handleDeleteTunnel(tunnel.id)}
                                                    title="Delete Tunnel"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <TunnelConfigModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTunnel}
                initialConfig={editingTunnel}
            />
        </div>
    );
};
