import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, FolderOpen, AlertCircle, HardDrive } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface DockerVolume {
    Name: string;
    Driver: string;
    Scope: string;
    Mountpoint: string;
    Labels: string;
    Size?: string;
}

interface DockerVolumesProps {
    profile: SshProfile;
    onBrowseVolume: (volumeName: string) => void;
}

export const DockerVolumes: React.FC<DockerVolumesProps> = ({ profile, onBrowseVolume }) => {
    const [volumes, setVolumes] = useState<DockerVolume[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVolumes = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const rawOutput = await api.getDockerVolumes(profile);
            const lines = rawOutput.split('\n').filter(Boolean);
            const parsed = lines.map(line => JSON.parse(line)) as DockerVolume[];
            setVolumes(parsed);
        } catch (err: any) {
            console.error(err);
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        fetchVolumes();
    }, [fetchVolumes]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-sidebar)]">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Database size={18} className="text-[var(--accent-color)]" />
                    <div>
                        <h3 className="text-sm font-bold text-[var(--text-main)]">Docker Volumes</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Manage and inspect persistent data</p>
                    </div>
                </div>
                <button
                    onClick={fetchVolumes}
                    disabled={loading}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                    title="Refresh Volumes"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col">
                {error ? (
                    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                ) : loading && volumes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                        <RefreshCw size={24} className="animate-spin text-[var(--accent-color)]" />
                        <span className="text-sm font-medium">Loading volumes...</span>
                    </div>
                ) : volumes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
                        <HardDrive size={48} className="text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-main)]">No volumes found</span>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[var(--bg-sidebar)] border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Driver</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Mountpoint</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {volumes.map((v) => (
                                    <tr key={v.Name} className="hover:bg-[var(--hover-color)]/30 transition-colors group">
                                        <td className="px-4 py-3 font-mono">
                                            <div className="font-bold text-[var(--text-main)] truncate max-w-[200px]" title={v.Name}>{v.Name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-block px-2 py-0.5 rounded bg-neutral-500/10 border border-neutral-500/20 text-[10px] text-[var(--text-muted)] font-mono">
                                                {v.Driver}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="truncate max-w-[250px] text-[10px] font-mono text-[var(--text-muted)]" title={v.Mountpoint}>
                                                {v.Mountpoint}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => onBrowseVolume(v.Name)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white font-medium rounded transition-colors text-xs"
                                            >
                                                <FolderOpen size={12} />
                                                <span>Browse</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
