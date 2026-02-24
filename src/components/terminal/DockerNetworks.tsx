import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Plus, Trash2, X, Network } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';

interface DockerNetwork {
    Name: string;
    Driver: string;
    Scope: string;
}

interface DockerNetworksProps {
    profile: SshProfile;
}

export const DockerNetworks: React.FC<DockerNetworksProps> = ({ profile }) => {
    const confirmCustom = useConfirm();
    const [networks, setNetworks] = useState<DockerNetwork[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNetworkName, setNewNetworkName] = useState('');
    const [newNetworkDriver, setNewNetworkDriver] = useState('bridge');
    const [isCreating, setIsCreating] = useState(false);

    const fetchNetworks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const rawOutput = await api.getDockerNetworks(profile);
            const lines = rawOutput.split('\n').filter(Boolean);
            const parsed = lines.map(line => JSON.parse(line)) as DockerNetwork[];
            setNetworks(parsed);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        fetchNetworks();
    }, [fetchNetworks]);

    const handleCreateNetwork = async () => {
        if (!newNetworkName.trim()) return;
        
        const isConfirmed = await confirmCustom({
            title: 'Create Network',
            message: `Create a new network "${newNetworkName}" with driver "${newNetworkDriver}"?`,
            confirmLabel: 'Create',
            isDestructive: false
        });
        
        if (!isConfirmed) return;
        
        try {
            setIsCreating(true);
            await api.createDockerNetwork(profile, newNetworkName, newNetworkDriver);
            setShowCreateModal(false);
            setNewNetworkName('');
            setNewNetworkDriver('bridge');
            await fetchNetworks();
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setIsCreating(false);
        }
    };

    const handleRemoveNetwork = async (networkName: string) => {
        if (networkName === 'bridge' || networkName === 'host' || networkName === 'none') {
            setError('Cannot remove built-in networks');
            return;
        }

        const isConfirmed = await confirmCustom({
            title: 'Remove Network',
            message: `Are you sure you want to remove network "${networkName}"?`,
            confirmLabel: 'Remove',
            isDestructive: true
        });

        if (!isConfirmed) return;

        try {
            await api.removeDockerNetwork(profile, networkName);
            await fetchNetworks();
        } catch (err: any) {
            setError(err.toString());
        }
    };

    const builtinNetworks = ['bridge', 'host', 'none'];

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0">
                <div className="flex items-center gap-2">
                    <Network size={14} className="text-[#2496ED]" />
                    <span className="text-xs font-medium text-[var(--text-main)]">Docker Networks</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchNetworks}
                        disabled={loading}
                        className={`p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
                    >
                        <Plus size={12} />
                        Create Network
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {error && (
                    <div className="text-red-400 text-xs text-center py-2 mb-2 bg-red-500/10 rounded-lg">{error}</div>
                )}

                {loading && networks.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)]">
                        <RefreshCw size={16} className="animate-spin" />
                        <span className="text-sm">Fetching networks...</span>
                    </div>
                ) : networks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 opacity-50">
                        <Network size={48} className="text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-main)]">No networks found</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]">
                        <table className="w-full text-left text-xs text-[var(--text-main)]">
                            <thead className="bg-[var(--bg-sidebar)] border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Driver</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Scope</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {networks.map(n => (
                                    <tr key={n.Name} className="hover:bg-[var(--hover-color)]/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-[var(--accent-color)]">{n.Name}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded text-[10px]">
                                                {n.Driver}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text-muted)]">{n.Scope}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleRemoveNetwork(n.Name)}
                                                disabled={builtinNetworks.includes(n.Name)}
                                                className={`p-1.5 rounded transition-colors ${
                                                    builtinNetworks.includes(n.Name)
                                                        ? 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
                                                        : 'hover:bg-red-500/20 hover:text-red-400 text-[var(--text-main)]'
                                                }`}
                                                title={builtinNetworks.includes(n.Name) ? 'Cannot remove built-in networks' : 'Remove Network'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                            <span className="font-medium text-[var(--text-main)]">Create Network</span>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-[var(--hover-color)] rounded">
                                <X size={14} className="text-[var(--text-muted)]" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Network Name</label>
                                <input
                                    type="text"
                                    value={newNetworkName}
                                    onChange={(e) => setNewNetworkName(e.target.value)}
                                    placeholder="my-network"
                                    className="w-full px-3 py-2 text-xs bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Driver</label>
                                <select
                                    value={newNetworkDriver}
                                    onChange={(e) => setNewNetworkDriver(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)]"
                                >
                                    <option value="bridge">bridge</option>
                                    <option value="host">host</option>
                                    <option value="none">none</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateNetwork}
                                    disabled={!newNetworkName.trim() || isCreating}
                                    className="px-3 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 disabled:opacity-50 transition-colors"
                                >
                                    {isCreating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
