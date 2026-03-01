import React, { useEffect, useState, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Cpu, HardDrive, Zap, Activity } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface ServerMetrics {
    cpu_percent: number;
    ram_total: number;
    ram_used: number;
    ram_percent: number;
    disk_total: number;
    disk_used: number;
    disk_percent: number;
    load_1: number;
}

interface ResourceMonitorProps {
    profile: SshProfile;
    sessionId: string;
    show: boolean;
}

export const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ profile, sessionId, show }) => {
    const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!show) {
            setIsVisible(false);
            return;
        }

        let mounted = true;
        const setup = async () => {
            try {
                unlistenRef.current = await listen<ServerMetrics>(
                    `monitor_data_${sessionId}`,
                    (event) => {
                        if (!mounted) return;
                        setMetrics(event.payload);
                        setIsVisible(true);
                    }
                );
                await api.startMonitor(profile, sessionId);
            } catch (err) {
                console.error('Failed to start resource monitor:', err);
            }
        };

        setup();

        return () => {
            mounted = false;
            if (unlistenRef.current) unlistenRef.current();
            api.stopMonitor(sessionId).catch(console.error);
        };
    }, [sessionId, profile, show]);

    if (!show || !metrics || !isVisible) return null;

    const getBarColor = (percent: number) => {
        if (percent < 60) return 'bg-emerald-500';
        if (percent < 85) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    return (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-4 px-3 py-1.5 bg-[var(--bg-primary)]/80 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 select-none pointer-events-none">
            {/* CPU */}
            <div className="flex items-center gap-2">
                <Cpu size={12} className="text-[var(--text-muted)]" />
                <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] leading-none uppercase">CPU</span>
                        <span className="text-[10px] font-mono font-bold text-[var(--text-main)] leading-none">{metrics.cpu_percent.toFixed(0)}%</span>
                    </div>
                    <div className="w-16 h-1 bg-[var(--border-color)] rounded-full mt-1 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 rounded-full ${getBarColor(metrics.cpu_percent)}`}
                            style={{ width: `${metrics.cpu_percent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="w-[1px] h-6 bg-[var(--border-color)]" />

            {/* RAM */}
            <div className="flex items-center gap-2">
                <Zap size={12} className="text-[var(--text-muted)]" />
                <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] leading-none uppercase">RAM</span>
                        <span className="text-[10px] font-mono font-bold text-[var(--text-main)] leading-none">{metrics.ram_percent.toFixed(0)}%</span>
                    </div>
                    <div className="w-16 h-1 bg-[var(--border-color)] rounded-full mt-1 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 rounded-full ${getBarColor(metrics.ram_percent)}`}
                            style={{ width: `${metrics.ram_percent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="w-[1px] h-6 bg-[var(--border-color)]" />

            {/* Disk */}
            <div className="flex items-center gap-2">
                <HardDrive size={12} className="text-[var(--text-muted)]" />
                <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] leading-none uppercase">Disk</span>
                        <span className="text-[10px] font-mono font-bold text-[var(--text-main)] leading-none">{metrics.disk_percent.toFixed(0)}%</span>
                    </div>
                    <div className="w-16 h-1 bg-[var(--border-color)] rounded-full mt-1 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 rounded-full ${getBarColor(metrics.disk_percent)}`}
                            style={{ width: `${metrics.disk_percent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="w-[1px] h-6 bg-[var(--border-color)]" />

            {/* Load */}
            <div className="flex items-center gap-2">
                <Activity size={12} className="text-[var(--text-muted)]" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] leading-none uppercase">Load</span>
                    <span className="text-[10px] font-mono font-bold text-[var(--text-main)] leading-none mt-1">{metrics.load_1.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};
