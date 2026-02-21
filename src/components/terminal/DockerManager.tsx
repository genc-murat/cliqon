import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Square, RotateCw, Terminal, Box, RefreshCw, X, Trash2, ChevronRight } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';
import { DockerVolumes } from './DockerVolumes';
import { DockerVolumeBrowser } from './DockerVolumeBrowser';
import { DockerPortForwards } from './DockerPortForwards';
interface DockerContainer {
    ID: string;
    Names: string;
    Image: string;
    State: string;
    Status: string;
    Ports: string;
}

interface DockerStat {
    BlockIO: string;
    CPUPerc: string;
    Container: string;
    ID: string;
    MemPerc: string;
    MemUsage: string;
    Name: string;
    NetIO: string;
    PIDs: string;
}

interface DockerManagerProps {
    profile: SshProfile;
    sessionId: string;
    onClose: () => void;
    onViewLogs: (containerId: string) => void;
    onExec: (containerId: string) => void;
    isEmbedded?: boolean;
}

export const DockerManager: React.FC<DockerManagerProps> = ({ profile, onClose, onViewLogs, onExec, isEmbedded }) => {
    const { height, startResizing, isResizing } = useResizable(
        280, // default height
        180, // min height
        800, // max height
        'top',
        'cliqon-docker-height'
    );

    const [activeTab, setActiveTab] = useState<'containers' | 'volumes' | 'ports'>('containers');
    const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
    const [browsingVolume, setBrowsingVolume] = useState<string | null>(null);

    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [stats, setStats] = useState<Record<string, DockerStat>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [statsLoading, setStatsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // containerId that is busy
    const isPruning = useRef<boolean>(false);

    const fetchContainers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const rawOutput = await api.getDockerContainers(profile);
            const lines = rawOutput.split('\n').filter(Boolean);
            const parsed = lines.map(line => JSON.parse(line)) as DockerContainer[];
            setContainers(parsed);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [profile]);

    const fetchStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const rawOutput = await api.getDockerStats(profile);
            const lines = rawOutput.split('\n').filter(Boolean);
            const parsed = lines.map(line => JSON.parse(line)) as DockerStat[];
            const statsMap: Record<string, DockerStat> = {};
            parsed.forEach(stat => {
                statsMap[stat.ID] = stat;
            });
            setStats(statsMap);
        } catch (err) {
            console.error("Failed to fetch docker stats", err);
        } finally {
            setStatsLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        fetchContainers();
        fetchStats();

        const intervalId = setInterval(() => {
            fetchContainers();
            fetchStats();
        }, 15000); // Polling every 15s

        return () => clearInterval(intervalId);
    }, [fetchContainers, fetchStats]);

    const handleAction = async (action: 'start' | 'stop' | 'restart', containerId: string) => {
        try {
            setActionLoading(containerId);
            if (action === 'start') {
                await api.startDockerContainer(profile, containerId);
            } else if (action === 'stop') {
                await api.stopDockerContainer(profile, containerId);
            } else if (action === 'restart') {
                await api.restartDockerContainer(profile, containerId);
            }
            await fetchContainers(); // refresh immediately
            await fetchStats();
        } catch (err: any) {
            console.error(`Error performing ${action} on ${containerId}:`, err);
            // Optionally set error state or show a toast
        } finally {
            setActionLoading(null);
        }
    };

    const handlePrune = async () => {
        if (!confirm("Are you sure you want to prune the Docker system? This will remove all unused containers, networks, images, and optionally, volumes.")) return;
        try {
            isPruning.current = true;
            setActionLoading('pruning');
            await api.dockerSystemPrune(profile);
            await fetchContainers();
            await fetchStats();
        } catch (err: any) {
            console.error("Failed to prune system", err);
        } finally {
            isPruning.current = false;
            setActionLoading(null);
        }
    };

    const handleBulkAction = async (action: 'start' | 'stop' | 'restart' | 'remove') => {
        if (selectedContainers.size === 0) return;

        let confirmMsg = `Are you sure you want to ${action} ${selectedContainers.size} container(s)?`;
        if (action === 'remove') confirmMsg += ' This action is irreversible.';
        if (!confirm(confirmMsg)) return;

        try {
            setActionLoading('bulk');
            const promises = Array.from(selectedContainers).map(async (containerId) => {
                if (action === 'start') await api.startDockerContainer(profile, containerId);
                else if (action === 'stop') await api.stopDockerContainer(profile, containerId);
                else if (action === 'restart') await api.restartDockerContainer(profile, containerId);
            });
            await Promise.allSettled(promises);
            setSelectedContainers(new Set());
            await fetchContainers();
            await fetchStats();
        } catch (err: any) {
            console.error(`Error performing bulk ${action}:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    const toggleContainerSelection = (containerId: string) => {
        const newSet = new Set(selectedContainers);
        if (newSet.has(containerId)) newSet.delete(containerId);
        else newSet.add(containerId);
        setSelectedContainers(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedContainers.size === containers.length) {
            setSelectedContainers(new Set());
        } else {
            setSelectedContainers(new Set(containers.map(c => c.ID)));
        }
    };

    return (
        <div
            className={`bg-[var(--bg-sidebar)] shrink-0 overflow-hidden relative flex flex-col ${isEmbedded ? 'flex-1 h-full' : 'border-t border-[var(--border-color)]'}`}
            style={isEmbedded ? {} : { height }}
        >
            {/* Resize Handle */}
            {!isEmbedded && (
                <div
                    onMouseDown={startResizing}
                    className={`
                        absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-50 
                        transition-colors duration-200 group
                        ${isResizing ? 'bg-[var(--accent-color)]' : 'hover:bg-[var(--accent-color)]/30'}
                    `}
                >
                    <div className={`
                        absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        w-12 h-1 rounded-full bg-[var(--border-color)] group-hover:bg-[var(--accent-color)]/50
                        transition-colors
                        ${isResizing ? 'bg-[var(--accent-color)]' : ''}
                    `} />
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0 select-none">
                <div className="flex items-center justify-between px-5 py-2">
                    <div className="flex items-center gap-2">
                        <Box size={16} className="text-[#2496ED]" />
                        <span className="text-sm font-bold text-[var(--text-main)]">Docker Architecture</span>
                        <div className="flex bg-[var(--bg-sidebar)] p-0.5 rounded-lg border border-[var(--border-color)] ml-4">
                            {(<button
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'containers' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                onClick={() => { setActiveTab('containers'); setBrowsingVolume(null); }}
                            >
                                Containers
                            </button>)}
                            <button
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'volumes' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                onClick={() => setActiveTab('volumes')}
                            >
                                Volumes
                            </button>
                            <button
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'ports' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                onClick={() => { setActiveTab('ports'); setBrowsingVolume(null); }}
                            >
                                Ports
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
                {/* Toolbar for Containers tab */}
                {activeTab === 'containers' && (
                    <div className="flex items-center gap-2 px-5 py-1.5 bg-[var(--bg-sidebar)] border-t border-[var(--border-color)] text-xs">
                        <button
                            onClick={() => { fetchContainers(); fetchStats(); }}
                            disabled={loading || statsLoading}
                            className={`p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors ${(loading || statsLoading) ? 'animate-spin' : ''}`}
                            title="Refresh"
                        >
                            <RefreshCw size={12} />
                        </button>
                        <div className="w-px h-3 bg-[var(--border-color)] mx-1" />
                        <button
                            onClick={handlePrune}
                            disabled={isPruning.current || actionLoading === 'pruning'}
                            className={`flex items-center gap-1 p-1.5 rounded-lg transition-colors text-red-400 hover:bg-red-500/10 hover:text-red-300 ${actionLoading === 'pruning' ? 'opacity-50' : ''}`}
                            title="System Prune"
                        >
                            <Trash2 size={12} />
                            <span>Prune</span>
                        </button>

                        {selectedContainers.size > 0 && (
                            <>
                                <div className="w-px h-3 bg-[var(--border-color)] mx-1" />
                                <span className="text-[var(--text-muted)] italic mr-2 text-[10px]">
                                    {selectedContainers.size} selected
                                </span>
                                <button onClick={() => handleBulkAction('start')} className="flex items-center gap-1 p-1 text-green-400 hover:bg-green-500/10 rounded">
                                    <Play size={12} /> Start
                                </button>
                                <button onClick={() => handleBulkAction('stop')} className="flex items-center gap-1 p-1 text-red-400 hover:bg-red-500/10 rounded">
                                    <Square size={12} /> Stop
                                </button>
                                <button onClick={() => handleBulkAction('restart')} className="flex items-center gap-1 p-1 text-amber-400 hover:bg-amber-500/10 rounded">
                                    <RotateCw size={12} /> Restart
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'ports' ? (
                    <DockerPortForwards containers={containers} host={profile.host} />
                ) : activeTab === 'volumes' ? (
                    browsingVolume ? (
                        <DockerVolumeBrowser
                            profile={profile}
                            volumeName={browsingVolume}
                            onBack={() => setBrowsingVolume(null)}
                        />
                    ) : (
                        <DockerVolumes
                            profile={profile}
                            onBrowseVolume={setBrowsingVolume}
                        />
                    )
                ) : (
                    <div className="flex-1 overflow-auto p-4 bg-[var(--bg-sidebar)]">
                        {error ? (
                            <div className="text-red-400 text-xs text-center py-4 bg-red-500/10 rounded-lg p-4">{error}</div>
                        ) : loading && containers.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)]">
                                <RefreshCw size={16} className="animate-spin" />
                                <span className="text-sm">Fetching containers...</span>
                            </div>
                        ) : containers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-10 opacity-50">
                                <Box size={48} className="text-[var(--text-muted)]" />
                                <span className="text-sm text-[var(--text-main)]">No containers found</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]">
                                <table className="w-full text-left text-xs text-[var(--text-main)]">
                                    <thead className="bg-[var(--bg-sidebar)] border-b border-[var(--border-color)]">
                                        <tr>
                                            <th className="px-4 py-3 w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={containers.length > 0 && selectedContainers.size === containers.length}
                                                    onChange={toggleSelectAll}
                                                    className="rounded bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--accent-color)]"
                                                />
                                            </th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Image</th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)] text-center">State</th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">CPU / RAM</th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Ports</th>
                                            <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)] text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-color)]">
                                        {containers.map(c => {
                                            const isRunning = c.State === 'running';
                                            const isBusy = actionLoading === c.ID;

                                            return (
                                                <tr key={c.ID} className={`hover:bg-[var(--hover-color)]/30 transition-colors group ${selectedContainers.has(c.ID) ? 'bg-[var(--accent-color)]/5' : ''}`}>
                                                    <td className="px-4 py-3 w-8">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedContainers.has(c.ID)}
                                                            onChange={() => toggleContainerSelection(c.ID)}
                                                            className="rounded bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--accent-color)] cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                                                        <div className="font-bold text-[var(--accent-color)] truncate max-w-[150px]" title={c.Names}>{c.Names}</div>
                                                        <div className="text-[10px] text-[var(--text-muted)]">{c.ID.substring(0, 12)}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="truncate max-w-[150px] text-[var(--text-muted)]" title={c.Image}>{c.Image}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${isRunning ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-neutral-500/10 text-[var(--text-muted)] border border-neutral-500/20'}`}>
                                                            {c.State}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                                                        {c.Status}
                                                    </td>
                                                    <td className="px-4 py-3 text-[11px] font-mono">
                                                        {isRunning && stats[c.ID] ? (
                                                            <div className="flex flex-col gap-1 min-w-[100px]">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[var(--accent-color)]">{stats[c.ID].CPUPerc}</span>
                                                                    <span className="text-[10px] text-[var(--text-muted)]">CPU</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[#10B981]">{stats[c.ID].MemPerc}</span>
                                                                    <span className="text-[10px] text-[var(--text-muted)]">{stats[c.ID].MemUsage.split(' / ')[0]}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[var(--text-muted)] opacity-50">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="truncate max-w-[150px] text-[10px] font-mono text-[var(--text-muted)]" title={c.Ports}>{c.Ports || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            {!isRunning ? (
                                                                <button
                                                                    disabled={isBusy}
                                                                    onClick={() => handleAction('start', c.ID)}
                                                                    className="p-1.5 hover:bg-green-500/20 hover:text-green-400 rounded transition-colors text-[var(--text-main)] disabled:opacity-50"
                                                                    title="Start"
                                                                >
                                                                    <Play size={14} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    disabled={isBusy}
                                                                    onClick={() => handleAction('stop', c.ID)}
                                                                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors text-[var(--text-main)] disabled:opacity-50"
                                                                    title="Stop"
                                                                >
                                                                    <Square size={14} />
                                                                </button>
                                                            )}

                                                            <button
                                                                disabled={isBusy}
                                                                onClick={() => handleAction('restart', c.ID)}
                                                                className="p-1.5 hover:bg-amber-500/20 hover:text-amber-400 rounded transition-colors text-[var(--text-main)] disabled:opacity-50"
                                                                title="Restart"
                                                            >
                                                                <RotateCw size={14} className={isBusy ? "animate-spin" : ""} />
                                                            </button>

                                                            <div className="w-px h-4 bg-[var(--border-color)] mx-1" />

                                                            <button
                                                                onClick={() => onViewLogs(c.ID)}
                                                                className="p-1.5 hover:bg-[var(--accent-color)]/20 hover:text-[var(--accent-color)] rounded transition-colors text-[var(--text-main)]"
                                                                title="View Logs in Terminal"
                                                            >
                                                                <Terminal size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onExec(c.ID)}
                                                                disabled={!isRunning}
                                                                className="p-1.5 hover:bg-[var(--accent-color)]/20 hover:text-[var(--accent-color)] rounded transition-colors text-[var(--text-main)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--text-main)]"
                                                                title="Interactive Shell (Exec)"
                                                            >
                                                                <ChevronRight size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
