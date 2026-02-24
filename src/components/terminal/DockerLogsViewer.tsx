import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Search, ChevronDown, Play } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface DockerContainer {
    ID: string;
    Names: string;
    Image: string;
    State: string;
    Status: string;
}

interface DockerLogsViewerProps {
    containers: DockerContainer[];
    profile: SshProfile;
}

export const DockerLogsViewer: React.FC<DockerLogsViewerProps> = ({ containers, profile }) => {
    const [selectedContainer, setSelectedContainer] = useState<string>('');
    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [useRegex, setUseRegex] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [tailLines, setTailLines] = useState<number>(500);

    const fetchLogs = async () => {
        if (!selectedContainer) return;
        try {
            setLoading(true);
            setError(null);
            const result = await api.getDockerContainerLogs(profile, selectedContainer, tailLines);
            setLogs(result);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (containers.length > 0 && !selectedContainer) {
            const running = containers.find(c => c.State === 'running');
            setSelectedContainer(running?.ID || containers[0]?.ID || '');
        }
    }, [containers]);

    useEffect(() => {
        if (selectedContainer) {
            fetchLogs();
        }
    }, [selectedContainer, tailLines]);

    const filteredLogs = useMemo(() => {
        if (!searchQuery || !logs) return logs;
        
        try {
            if (useRegex) {
                const regex = new RegExp(searchQuery, 'gi');
                const lines = logs.split('\n');
                return lines.filter(line => regex.test(line)).join('\n');
            } else {
                const query = searchQuery.toLowerCase();
                const lines = logs.split('\n');
                return lines.filter(line => line.toLowerCase().includes(query)).join('\n');
            }
        } catch (e) {
            return logs;
        }
    }, [logs, searchQuery, useRegex]);

    const stats = useMemo(() => {
        const lines = filteredLogs.split('\n').filter(Boolean);
        const errorCount = lines.filter(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('err]') || l.toLowerCase().includes('fatal')).length;
        const warnCount = lines.filter(l => l.toLowerCase().includes('warn') || l.toLowerCase().includes('warning')).length;
        const infoCount = lines.filter(l => l.toLowerCase().includes('info')).length;
        return { total: lines.length, error: errorCount, warn: warnCount, info: infoCount };
    }, [filteredLogs]);

    const logLines = filteredLogs.split('\n');

    return (
        <div className="flex-1 flex flex-col bg-[var(--bg-sidebar)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0">
                <div className="relative flex-1 max-w-[300px]">
                    <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <select
                        value={selectedContainer}
                        onChange={(e) => setSelectedContainer(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)] appearance-none"
                    >
                        <option value="">Select container...</option>
                        {containers.map(c => (
                            <option key={c.ID} value={c.ID}>
                                {c.Names.replace(/^\//, '')} ({c.State})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1 relative">
                    <Search size={12} className="text-[var(--text-muted)] absolute left-2" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 pr-2 py-1.5 text-xs bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] w-40"
                    />
                </div>

                <button
                    onClick={() => setUseRegex(!useRegex)}
                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                        useRegex 
                            ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' 
                            : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                    }`}
                    title="Use Regex"
                >
                    .*
                </button>

                <select
                    value={tailLines}
                    onChange={(e) => setTailLines(Number(e.target.value))}
                    className="text-xs bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] px-2 py-1.5 focus:outline-none focus:border-[var(--accent-color)]"
                >
                    <option value={100}>100 lines</option>
                    <option value={500}>500 lines</option>
                    <option value={1000}>1000 lines</option>
                    <option value={2000}>2000 lines</option>
                </select>

                <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`p-1.5 rounded-lg transition-colors ${
                        autoScroll 
                            ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10' 
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)]'
                    }`}
                    title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                >
                    <Play size={14} className={autoScroll ? '' : 'rotate-90'} />
                </button>

                <button
                    onClick={fetchLogs}
                    disabled={loading || !selectedContainer}
                    className={`p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="Refresh Logs"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {selectedContainer && (
                <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)] text-xs shrink-0">
                    <span className="text-[var(--text-muted)]">
                        {stats.total} lines
                        {searchQuery && ` (${filteredLogs.split('\n').filter(Boolean).length} matched)`}
                    </span>
                    <span className="text-red-400">{stats.error} errors</span>
                    <span className="text-amber-400">{stats.warn} warnings</span>
                    <span className="text-blue-400">{stats.info} info</span>
                </div>
            )}

            <div className="flex-1 overflow-auto p-2 font-mono text-xs">
                {!selectedContainer ? (
                    <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                        Select a container to view logs
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center h-full gap-2 text-[var(--text-muted)]">
                        <RefreshCw size={16} className="animate-spin" />
                        Loading logs...
                    </div>
                ) : error ? (
                    <div className="text-red-400 p-4">{error}</div>
                ) : (
                    <div className="space-y-0">
                        {logLines.map((line, idx) => {
                            const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('err]') || line.toLowerCase().includes('fatal');
                            const isWarn = line.toLowerCase().includes('warn') || line.toLowerCase().includes('warning');
                            const isInfo = line.toLowerCase().includes('info');
                            
                            let textColor = 'text-[var(--text-main)]';
                            if (isError) textColor = 'text-red-400';
                            else if (isWarn) textColor = 'text-amber-400';
                            else if (isInfo) textColor = 'text-blue-400';

                            const isHighlighted = searchQuery && (
                                useRegex 
                                    ? new RegExp(searchQuery, 'gi').test(line)
                                    : line.toLowerCase().includes(searchQuery.toLowerCase())
                            );

                            return (
                                <div 
                                    key={idx} 
                                    className={`px-2 py-0.5 hover:bg-[var(--hover-color)]/30 ${textColor} ${isHighlighted ? 'bg-[var(--accent-color)]/20' : ''}`}
                                >
                                    <span className="text-[var(--text-muted)] mr-2 select-none">{idx + 1}</span>
                                    {line || ' '}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
