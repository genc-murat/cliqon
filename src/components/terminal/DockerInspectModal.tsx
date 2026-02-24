import React, { useEffect, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface DockerInspectModalProps {
    profile: SshProfile;
    containerId: string;
    onClose: () => void;
}

interface DockerInspectData {
    Id: string;
    Name: string;
    Image: string;
    Created: string;
    State: {
        Status: string;
        Running: boolean;
        Paused: boolean;
        Restarting: boolean;
        OOMKilled: boolean;
        Dead: boolean;
        Pid: number;
        ExitCode: number;
        Health?: {
            Status: string;
            FailingStreak: number;
            Log: Array<{
                Start: string;
                End: string;
                ExitCode: number;
                Output: string;
            }>;
            StartPeriod: string;
            LastProbeTime: string;
            LastExitTime: string;
        };
    };
    Config: {
        Env: string[];
        Cmd: string[];
        Entrypoint: string | null;
        WorkingDir: string;
        ExposedPorts: Record<string, object>;
    };
    Mounts: Array<{
        Type: string;
        Source: string;
        Destination: string;
    }>;
    NetworkSettings: {
        Networks: Record<string, {
            IPAddress: string;
            Gateway: string;
            MacAddress: string;
        }>;
    };
}

export const DockerInspectModal: React.FC<DockerInspectModalProps> = ({ profile, containerId, onClose }) => {
    const [data, setData] = useState<DockerInspectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'info' | 'env' | 'mounts' | 'network' | 'health'>('info');

    useEffect(() => {
        const fetchInspect = async () => {
            try {
                setLoading(true);
                const rawOutput = await api.inspectDockerContainer(profile, containerId);
                const parsed = JSON.parse(rawOutput);
                setData(Array.isArray(parsed) ? parsed[0] : parsed);
            } catch (err: any) {
                setError(err.toString());
            } finally {
                setLoading(false);
            }
        };
        fetchInspect();
    }, [profile, containerId]);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const copyJson = () => {
        if (data) {
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            setCopiedField('json');
            setTimeout(() => setCopiedField(null), 2000);
        }
    };

    if (!data) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
                <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl w-[600px] max-h-[80vh] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                        <span className="font-medium text-[var(--text-main)]">Container Inspect</span>
                        <button onClick={onClose} className="p-1 hover:bg-[var(--hover-color)] rounded">
                            <X size={16} className="text-[var(--text-muted)]" />
                        </button>
                    </div>
                    <div className="p-6 flex items-center justify-center">
                        {loading ? (
                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                <div className="w-4 h-4 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
                                <span>Loading...</span>
                            </div>
                        ) : error ? (
                            <div className="text-red-400 text-sm">{error}</div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl w-[700px] max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-main)]">Container Inspect</span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">{containerId.substring(0, 12)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyJson}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded transition-colors"
                        >
                            {copiedField === 'json' ? <Check size={12} /> : <Copy size={12} />}
                            {copiedField === 'json' ? 'Copied!' : 'Copy JSON'}
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-[var(--hover-color)] rounded">
                            <X size={16} className="text-[var(--text-muted)]" />
                        </button>
                    </div>
                </div>

                <div className="flex border-b border-[var(--border-color)] shrink-0">
                    {(['info', 'env', 'mounts', 'network', 'health'] as const).map(section => (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                                activeSection === section
                                    ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                        >
                            {section}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {activeSection === 'info' && (
                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Name</div>
                                <div className="col-span-2 font-mono text-[var(--text-main)] flex items-center gap-2">
                                    {data.Name.replace(/^\//, '')}
                                    <button onClick={() => copyToClipboard(data.Name, 'name')} className="p-1 hover:bg-[var(--hover-color)] rounded">
                                        {copiedField === 'name' ? <Check size={10} /> : <Copy size={10} className="text-[var(--text-muted)]" />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Image</div>
                                <div className="col-span-2 font-mono text-[var(--text-main)]">{data.Image}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">ID</div>
                                <div className="col-span-2 font-mono text-[var(--text-main)]">{data.Id.substring(0, 12)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Created</div>
                                <div className="col-span-2 text-[var(--text-main)]">{new Date(data.Created).toLocaleString()}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Status</div>
                                <div className="col-span-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                        data.State.Running ? 'bg-green-500/10 text-green-400' : 'bg-neutral-500/10 text-[var(--text-muted)]'
                                    }`}>
                                        {data.State.Status}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">PID</div>
                                <div className="col-span-2 text-[var(--text-main)]">{data.State.Pid}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Working Dir</div>
                                <div className="col-span-2 font-mono text-[var(--text-main)]">{data.Config.WorkingDir || '/'}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Entrypoint</div>
                                <div className="col-span-2 font-mono text-[var(--text-main)]">{data.Config.Entrypoint || '-'}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-[var(--text-muted)]">Cmd</div>
                                <div className="col-span-2 font-mono text-[var(--text-main)]">{data.Config.Cmd?.join(' ') || '-'}</div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'env' && (
                        <div className="space-y-1">
                            {data.Config.Env && data.Config.Env.length > 0 ? (
                                data.Config.Env.map((env, idx) => {
                                    const [key, ...valueParts] = env.split('=');
                                    return (
                                        <div key={idx} className="flex items-start gap-2 text-xs font-mono py-1 hover:bg-[var(--hover-color)]/30 px-2 rounded">
                                            <span className="text-[var(--accent-color)] shrink-0">{key}</span>
                                            <span className="text-[var(--text-muted)]">=</span>
                                            <span className="text-[var(--text-main)] break-all">{valueParts.join('=')}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-[var(--text-muted)] text-xs">No environment variables</div>
                            )}
                        </div>
                    )}

                    {activeSection === 'mounts' && (
                        <div className="space-y-2">
                            {data.Mounts && data.Mounts.length > 0 ? (
                                data.Mounts.map((mount, idx) => (
                                    <div key={idx} className="bg-[var(--bg-sidebar)] rounded-lg p-3 text-xs border border-[var(--border-color)]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded text-[10px] font-medium uppercase">{mount.Type}</span>
                                        </div>
                                        <div className="grid grid-cols-[80px_1fr] gap-1">
                                            <span className="text-[var(--text-muted)]">Source:</span>
                                            <span className="font-mono text-[var(--text-main)] break-all">{mount.Source}</span>
                                            <span className="text-[var(--text-muted)]">Dest:</span>
                                            <span className="font-mono text-[var(--text-main)] break-all">{mount.Destination}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[var(--text-muted)] text-xs">No mounts</div>
                            )}
                        </div>
                    )}

                    {activeSection === 'network' && (
                        <div className="space-y-2">
                            {data.NetworkSettings?.Networks && Object.keys(data.NetworkSettings.Networks).length > 0 ? (
                                Object.entries(data.NetworkSettings.Networks).map(([networkName, networkData]) => (
                                    <div key={networkName} className="bg-[var(--bg-sidebar)] rounded-lg p-3 text-xs border border-[var(--border-color)]">
                                        <div className="font-medium text-[var(--accent-color)] mb-2">{networkName}</div>
                                        <div className="grid grid-cols-[80px_1fr] gap-1">
                                            <span className="text-[var(--text-muted)]">IP Address:</span>
                                            <span className="font-mono text-[var(--text-main)]">{networkData.IPAddress || '-'}</span>
                                            <span className="text-[var(--text-muted)]">Gateway:</span>
                                            <span className="font-mono text-[var(--text-main)]">{networkData.Gateway || '-'}</span>
                                            <span className="text-[var(--text-muted)]">MAC:</span>
                                            <span className="font-mono text-[var(--text-main)]">{networkData.MacAddress || '-'}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[var(--text-muted)] text-xs">No network settings</div>
                            )}
                        </div>
                    )}

                    {activeSection === 'health' && (
                        <div className="space-y-3 text-xs">
                            {data.State.Health ? (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-[var(--text-muted)]">Status</div>
                                        <div className="col-span-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                data.State.Health.Status === 'healthy' ? 'bg-green-500/10 text-green-400' :
                                                data.State.Health.Status === 'unhealthy' ? 'bg-red-500/10 text-red-400' :
                                                'bg-yellow-500/10 text-yellow-400'
                                            }`}>
                                                {data.State.Health.Status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-[var(--text-muted)]">Failing Streak</div>
                                        <div className="col-span-2 text-[var(--text-main)]">{data.State.Health.FailingStreak}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-[var(--text-muted)]">Start Period</div>
                                        <div className="col-span-2 text-[var(--text-main)]">{data.State.Health.StartPeriod}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-[var(--text-muted)]">Last Probe</div>
                                        <div className="col-span-2 text-[var(--text-main)]">{data.State.Health.LastProbeTime}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-[var(--text-muted)]">Last Exit</div>
                                        <div className="col-span-2 text-[var(--text-main)]">{data.State.Health.LastExitTime}</div>
                                    </div>
                                    {data.State.Health.Log && data.State.Health.Log.length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-[var(--text-muted)] mb-2">Recent Logs</div>
                                            <div className="space-y-2 max-h-48 overflow-auto">
                                                {data.State.Health.Log.slice(-5).map((log, idx) => (
                                                    <div key={idx} className="bg-[var(--bg-sidebar)] rounded p-2 border border-[var(--border-color)]">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                                log.ExitCode === 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                                Exit Code: {log.ExitCode}
                                                            </span>
                                                            <span className="text-[var(--text-muted)] text-[10px]">
                                                                {log.Start} → {log.End}
                                                            </span>
                                                        </div>
                                                        <div className="font-mono text-[10px] text-[var(--text-main)] whitespace-pre-wrap break-all">
                                                            {log.Output.substring(0, 200)}{log.Output.length > 200 ? '...' : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-[var(--text-muted)] text-xs">No health check configured for this container</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
