import React, { useEffect, useState, useRef, useCallback } from 'react';
import { RefreshCw, Filter, Zap } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface DockerEvent {
    Type: string;
    Action: string;
    Actor: {
        ID: string;
        Attributes: Record<string, string>;
    };
    time: number;
}

interface DockerEventsProps {
    profile: SshProfile;
}

const eventColors: Record<string, string> = {
    'create': 'text-blue-400',
    'start': 'text-green-400',
    'stop': 'text-red-400',
    'die': 'text-amber-400',
    'destroy': 'text-red-500',
    'pause': 'text-yellow-400',
    'unpause': 'text-green-400',
    'kill': 'text-red-500',
    'restart': 'text-orange-400',
    'commit': 'text-purple-400',
    'attach': 'text-cyan-400',
    'detach': 'text-gray-400',
};

const typeIcons: Record<string, string> = {
    'container': '📦',
    'image': '🖼️',
    'volume': '💾',
    'network': '🌐',
    'daemon': '⚙️',
};

export const DockerEvents: React.FC<DockerEventsProps> = ({ profile }) => {
    const [events, setEvents] = useState<DockerEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<number | null>(null);

    const fetchEvents = useCallback(async () => {
        try {
            const filter = typeFilter !== 'all' ? `type=${typeFilter}` : undefined;
            const rawOutput = await api.getDockerEvents(profile, filter);
            const lines = rawOutput.split('\n').filter(Boolean);
            const parsed = lines.map(line => {
                try {
                    return JSON.parse(line) as DockerEvent;
                } catch {
                    return null;
                }
            }).filter(Boolean) as DockerEvent[];
            
            setEvents(parsed.slice(-100));
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [profile, typeFilter]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = window.setInterval(() => {
                fetchEvents();
            }, 2000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRefresh, fetchEvents]);

    useEffect(() => {
        if (autoRefresh && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events, autoRefresh]);

    const getEventColor = (action: string): string => {
        for (const [key, value] of Object.entries(eventColors)) {
            if (action.includes(key)) {
                return value;
            }
        }
        return 'text-[var(--text-main)]';
    };

    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString();
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0">
                <Zap size={14} className="text-[#2496ED]" />
                <span className="text-xs font-medium text-[var(--text-main)]">Docker Events</span>
                
                <div className="w-px h-4 bg-[var(--border-color)]" />
                
                <div className="flex items-center gap-1">
                    <Filter size={12} className="text-[var(--text-muted)]" />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="text-xs bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] px-2 py-1 focus:outline-none focus:border-[var(--accent-color)]"
                    >
                        <option value="all">All Types</option>
                        <option value="container">Container</option>
                        <option value="image">Image</option>
                        <option value="volume">Volume</option>
                        <option value="network">Network</option>
                    </select>
                </div>

                <div className="flex-1" />

                <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-colors ${
                        autoRefresh 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)] border-[var(--border-color)]'
                    }`}
                    title={autoRefresh ? 'Auto-refresh ON (2s)' : 'Auto-refresh OFF'}
                >
                    <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} />
                    {autoRefresh ? 'Live' : 'Paused'}
                </button>

                <button
                    onClick={fetchEvents}
                    disabled={loading}
                    className={`p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="Refresh"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-auto font-mono text-xs" ref={scrollRef}>
                {error && (
                    <div className="text-red-400 text-xs text-center py-2 px-4 bg-red-500/10 m-2 rounded-lg">{error}</div>
                )}

                {loading && events.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)]">
                        <RefreshCw size={16} className="animate-spin" />
                        <span className="text-sm">Fetching events...</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 opacity-50">
                        <Zap size={48} className="text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-main)]">No events in the last 60 seconds</span>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-color)]/30">
                        {events.map((event, idx) => (
                            <div 
                                key={`${event.time}-${idx}`}
                                className="flex items-start gap-3 px-4 py-2 hover:bg-[var(--hover-color)]/20"
                            >
                                <span className="text-[var(--text-muted)] shrink-0 w-20">
                                    {formatTime(event.time)}
                                </span>
                                <span className="shrink-0 text-xs">
                                    {typeIcons[event.Type] || '❓'}
                                </span>
                                <span className="px-1.5 py-0.5 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded text-[10px] shrink-0">
                                    {event.Type}
                                </span>
                                <span className={`font-medium shrink-0 ${getEventColor(event.Action)}`}>
                                    {event.Action}
                                </span>
                                <span className="text-[var(--text-muted)] truncate">
                                    {event.Actor?.Attributes?.name || event.Actor?.ID?.substring(0, 12) || '-'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
