import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Activity, Cpu, HardDrive, MemoryStick, Server, X } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';

interface ServerMetrics {
    // ... existing interface ...
    cpu_percent: number;
    ram_total: number;
    ram_used: number;
    ram_percent: number;
    disk_total: number;
    disk_used: number;
    disk_percent: number;
    load_1: number;
    load_5: number;
    load_15: number;
    uptime: string;
    hostname: string;
    os_info: string;
}

interface ServerMonitorProps {
    profile: SshProfile;
    sessionId: string;
    onClose: () => void;
}

const MAX_HISTORY = 30;

// Mini sparkline component drawn with SVG
const Sparkline: React.FC<{ data: number[]; color: string; height?: number }> = ({ data, color, height = 32 }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const w = 120;
    const h = height;
    const points = data.map((v, i) => {
        const x = (i / (MAX_HISTORY - 1)) * w;
        const y = h - (v / max) * h;
        return `${x},${y}`;
    }).join(' ');

    // Create area fill
    const areaPoints = `0,${h} ${points} ${w},${h}`;

    return (
        <svg width={w} height={h} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
            <polygon
                fill={`${color}20`}
                points={areaPoints}
            />
        </svg>
    );
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getColor = (percent: number): string => {
    if (percent < 50) return '#10b981'; // green
    if (percent < 80) return '#f59e0b'; // amber
    return '#ef4444'; // red
};

// Circular progress gauge
const Gauge: React.FC<{ percent: number; color: string; size?: number }> = ({ percent, color, size = 64 }) => {
    const r = (size - 8) / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-color)" strokeWidth="6" />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
            />
        </svg>
    );
};

export const ServerMonitor: React.FC<ServerMonitorProps> = ({ profile, sessionId, onClose }) => {
    const { height, startResizing, isResizing } = useResizable(
        280, // default height
        180, // min height
        600, // max height
        'top',
        'cliqon-monitor-height'
    );

    const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
    const [cpuHistory, setCpuHistory] = useState<number[]>([]);
    const [ramHistory, setRamHistory] = useState<number[]>([]);
    const [diskHistory, setDiskHistory] = useState<number[]>([]);
    const [loadHistory, setLoadHistory] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);

    const pushHistory = useCallback((setter: React.Dispatch<React.SetStateAction<number[]>>, value: number) => {
        setter(prev => {
            const next = [...prev, value];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
    }, []);

    useEffect(() => {
        let mounted = true;

        const setup = async () => {
            try {
                // Listen for metrics
                unlistenRef.current = await listen<ServerMetrics>(
                    `monitor_data_${sessionId}`,
                    (event) => {
                        if (!mounted) return;
                        const m = event.payload;
                        setMetrics(m);
                        pushHistory(setCpuHistory, m.cpu_percent);
                        pushHistory(setRamHistory, m.ram_percent);
                        pushHistory(setDiskHistory, m.disk_percent);
                        pushHistory(setLoadHistory, m.load_1);
                    }
                );

                // Start the monitor
                await api.startMonitor(profile, sessionId);
            } catch (err: any) {
                if (mounted) setError(err.toString());
            }
        };

        setup();

        return () => {
            mounted = false;
            if (unlistenRef.current) unlistenRef.current();
            api.stopMonitor(sessionId).catch(console.error);
        };
    }, [sessionId, profile, pushHistory]);

    return (
        <div
            className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-hidden relative flex flex-col"
            style={{ height }}
        >
            {/* Resize Handle */}
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

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0 select-none">
                {/* ... header content ... */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-[var(--accent-color)]" />
                        <span className="text-sm font-bold text-[var(--text-main)]">Server Monitor</span>
                    </div>
                    {metrics && (
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono">
                            <span className="flex items-center gap-1"><Server size={10} /> {metrics.hostname}</span>
                            <span>•</span>
                            <span>{metrics.os_info}</span>
                            <span>•</span>
                            <span>{metrics.uptime}</span>
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {error ? (
                    <div className="text-red-400 text-xs text-center py-4">{error}</div>
                ) : !metrics ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)]">
                        <Activity size={16} className="animate-pulse" />
                        <span className="text-sm">Collecting metrics...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-4">
                        {/* CPU */}
                        <div className="relative p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden group hover:border-[var(--accent-color)]/30 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Cpu size={14} className="text-[var(--text-muted)]" />
                                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">CPU</span>
                                </div>
                                <div className="relative w-12 h-12">
                                    <Gauge percent={metrics.cpu_percent} color={getColor(metrics.cpu_percent)} size={48} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-main)]">
                                        {metrics.cpu_percent.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <Sparkline data={cpuHistory} color={getColor(metrics.cpu_percent)} />
                            <div className="mt-2 flex justify-between text-[10px] text-[var(--text-muted)]">
                                <span>Load: {metrics.load_1.toFixed(2)}</span>
                                <span>{metrics.load_5.toFixed(2)}</span>
                                <span>{metrics.load_15.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* RAM */}
                        <div className="relative p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden group hover:border-[var(--accent-color)]/30 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <MemoryStick size={14} className="text-[var(--text-muted)]" />
                                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Memory</span>
                                </div>
                                <div className="relative w-12 h-12">
                                    <Gauge percent={metrics.ram_percent} color={getColor(metrics.ram_percent)} size={48} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-main)]">
                                        {metrics.ram_percent.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <Sparkline data={ramHistory} color={getColor(metrics.ram_percent)} />
                            <div className="mt-2 flex justify-between text-[10px] text-[var(--text-muted)]">
                                <span>{formatBytes(metrics.ram_used)}</span>
                                <span>/ {formatBytes(metrics.ram_total)}</span>
                            </div>
                        </div>

                        {/* Disk */}
                        <div className="relative p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden group hover:border-[var(--accent-color)]/30 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <HardDrive size={14} className="text-[var(--text-muted)]" />
                                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Disk</span>
                                </div>
                                <div className="relative w-12 h-12">
                                    <Gauge percent={metrics.disk_percent} color={getColor(metrics.disk_percent)} size={48} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-main)]">
                                        {metrics.disk_percent.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <Sparkline data={diskHistory} color={getColor(metrics.disk_percent)} />
                            <div className="mt-2 flex justify-between text-[10px] text-[var(--text-muted)]">
                                <span>{formatBytes(metrics.disk_used)}</span>
                                <span>/ {formatBytes(metrics.disk_total)}</span>
                            </div>
                        </div>

                        {/* Load Average */}
                        <div className="relative p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl overflow-hidden group hover:border-[var(--accent-color)]/30 transition-all">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={14} className="text-[var(--text-muted)]" />
                                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Load Avg</span>
                            </div>
                            <div className="flex items-end gap-3 mb-3">
                                <div className="text-center">
                                    <div className="text-lg font-black text-[var(--text-main)]">{metrics.load_1.toFixed(2)}</div>
                                    <div className="text-[9px] text-[var(--text-muted)]">1m</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-bold text-[var(--text-main)] opacity-70">{metrics.load_5.toFixed(2)}</div>
                                    <div className="text-[9px] text-[var(--text-muted)]">5m</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-bold text-[var(--text-main)] opacity-50">{metrics.load_15.toFixed(2)}</div>
                                    <div className="text-[9px] text-[var(--text-muted)]">15m</div>
                                </div>
                            </div>
                            <Sparkline data={loadHistory} color="#6366f1" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
