import React, { useEffect, useState, useMemo } from 'react';
import { Play, Square, RotateCw, RefreshCw, Search, Clock } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface TimerInfo {
    next: string;
    left: string;
    last: string;
    passed: string;
    unit: string;
    activates: string;
}

interface TimerManagerProps {
    profile: SshProfile;
}

export const TimerManager: React.FC<TimerManagerProps> = ({ profile }) => {
    const [timers, setTimers] = useState<TimerInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchTimers = async () => {
        setLoading(true);
        setError(null);
        try {
            const raw = await api.getSystemTimers(profile);
            if (raw.trim() === "systemctl not found") {
                setError("Systemctl is not available on this server.");
            } else {
                const parsed: TimerInfo[] = raw
                    .split('\n')
                    .filter(line => line.includes('|'))
                    .map(line => {
                        const [next, left, last, passed, unit, activates] = line.split('|');
                        return { next, left, last, passed, unit, activates };
                    })
                    .filter(t => t.unit && t.unit.trim() !== "");
                setTimers(parsed);
            }
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id]);

    const handleAction = async (unit: string, action: 'start' | 'stop' | 'restart') => {
        setActionLoading(unit);
        try {
            const res = await api.manageService(profile, action, unit);
            if (res.toLowerCase().includes('failed') || res.toLowerCase().includes('error') || res.toLowerCase().includes('denied')) {
                throw new Error(res);
            }
            setTimeout(fetchTimers, 1000);
        } catch (err: any) {
            alert(`Failed to ${action} ${unit}: 
${err.message || String(err)}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTimers = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return timers.filter(t =>
            t.unit.toLowerCase().includes(query) ||
            t.activates.toLowerCase().includes(query)
        );
    }, [timers, searchQuery]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                    <input
                        type="text"
                        placeholder="Search timers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--accent-color)]"
                    />
                </div>
                <button
                    onClick={fetchTimers}
                    disabled={loading}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] rounded-md transition-colors"
                    title="Refresh List"
                >
                    <RefreshCw size={14} className={loading && !actionLoading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {error ? (
                    <div className="p-6 text-center text-red-400 text-sm">
                        {error}
                    </div>
                ) : loading && timers.length === 0 ? (
                    <div className="p-6 flex justify-center text-[var(--text-muted)]">
                        <RefreshCw size={20} className="animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-[var(--bg-sidebar)] z-10 shadow-sm">
                            <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                                <th className="px-4 py-2 font-medium">Timer Unit</th>
                                <th className="px-4 py-2 font-medium">Next Run</th>
                                <th className="px-4 py-2 font-medium">Left</th>
                                <th className="px-4 py-2 font-medium">Last Run</th>
                                <th className="px-4 py-2 font-medium">Activates</th>
                                <th className="px-4 py-2 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTimers.map((timer, i) => (
                                <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--hover-color)] transition-colors group">
                                    <td className="px-4 py-2 whitespace-nowrap font-medium text-[var(--text-main)]">
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-[var(--accent-color)]" />
                                            {timer.unit}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-[var(--text-main)]">
                                        {timer.next || '-'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-[var(--text-muted)]">
                                        {timer.left || '-'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-[var(--text-muted)]">
                                        {timer.last || '-'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-blue-400 font-mono text-[10px]">
                                        {timer.activates}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => handleAction(timer.unit, 'start')}
                                                disabled={actionLoading === timer.unit}
                                                className="p-1 rounded text-green-400 hover:bg-green-400/20 transition-colors disabled:opacity-30"
                                                title="Start/Enable"
                                            >
                                                <Play size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleAction(timer.unit, 'stop')}
                                                disabled={actionLoading === timer.unit}
                                                className="p-1 rounded text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-30"
                                                title="Stop/Disable"
                                            >
                                                <Square size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleAction(timer.unit, 'restart')}
                                                disabled={actionLoading === timer.unit}
                                                className="p-1 rounded text-blue-400 hover:bg-blue-400/20 transition-colors disabled:opacity-30"
                                                title="Restart"
                                            >
                                                <RotateCw size={14} className={actionLoading === timer.unit ? "animate-spin" : ""} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTimers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center text-[var(--text-muted)]">
                                        No timers found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
