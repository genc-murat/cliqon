import React, { useMemo } from 'react';
import { SshProfile, Snippet } from '../../types/connection';
import {
    Clock,
    Zap,
    Globe,
    Shield,
    Star,
    Monitor,
    Activity,
    ChevronRight
} from 'lucide-react';

interface WidgetProps {
    profiles: SshProfile[];
    snippets: Snippet[];
    onConnect: (profile: SshProfile) => void;
    onViewAll: () => void;
}

export const FavoritesWidget: React.FC<WidgetProps> = ({ profiles, onConnect, onViewAll }) => {
    const favorites = useMemo(() => profiles.filter(p => p.is_favorite).slice(0, 4), [profiles]);

    if (favorites.length === 0) return null;

    return (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                    <Star size={18} className="text-yellow-400 fill-yellow-400/20" />
                    Favorite Connections
                </h2>
                <button onClick={onViewAll} className="text-xs text-[var(--accent-color)] hover:underline">View all</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {favorites.map((profile) => (
                    <button
                        key={profile.id}
                        onClick={() => onConnect(profile)}
                        className="group relative flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--accent-color)]/50 hover:bg-white/10 transition-all duration-300 text-left"
                    >
                        <div className="p-2 rounded-lg bg-[var(--bg-secondary)]" style={{ color: profile.color || 'var(--accent-color)' }}>
                            <Monitor size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold truncate text-[var(--text-main)]">{profile.name}</h3>
                            <p className="text-[10px] text-[var(--text-muted)] truncate opacity-70">{profile.username}@{profile.host}</p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </button>
                ))}
            </div>
        </section>
    );
};

export const RecentActivityWidget: React.FC<WidgetProps> = ({ profiles, onConnect }) => {
    const recent = useMemo(() => {
        return [...profiles]
            .filter(p => p.last_used)
            .sort((a, b) => (b.last_used || 0) - (a.last_used || 0))
            .slice(0, 3);
    }, [profiles]);

    if (recent.length === 0) return null;

    return (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                <Clock size={18} className="text-blue-400" />
                Recent Activity
            </h2>
            <div className="space-y-2">
                {recent.map((profile) => (
                    <button
                        key={profile.id}
                        onClick={() => onConnect(profile)}
                        className="w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left group"
                    >
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-blue-400 font-mono text-xs group-hover:scale-110 transition-transform">
                            {profile.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                                <h3 className="text-sm font-bold truncate text-[var(--text-main)]">{profile.name}</h3>
                                <span className="text-[10px] text-[var(--text-muted)] opacity-50">
                                    {new Date((profile.last_used || 0) * 1000).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)] truncate opacity-70">Connected to {profile.host}</p>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
};

export const SnippetMacrosWidget: React.FC<WidgetProps> = ({ snippets }) => {
    const macros = useMemo(() => snippets.slice(0, 6), [snippets]);

    if (macros.length === 0) return null;

    return (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                <Zap size={18} className="text-yellow-400" />
                Quick Snippets
            </h2>
            <div className="grid grid-cols-2 gap-2">
                {macros.map((snippet) => (
                    <button
                        key={snippet.id}
                        onClick={() => window.dispatchEvent(new CustomEvent('cliqon:run-snippet', { detail: snippet }))}
                        className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-yellow-500/30 hover:bg-yellow-500/5 transition-all text-left overflow-hidden group"
                    >
                        <Zap size={14} className="text-yellow-400 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="text-xs font-medium truncate text-[var(--text-main)]">{snippet.name}</span>
                    </button>
                ))}
            </div>
        </section>
    );
};

export const SystemHealthWidget: React.FC<WidgetProps> = ({ profiles }) => {
    const stats = useMemo(() => [
        { label: 'Total Hosts', value: profiles.length, icon: Globe, color: 'text-blue-400' },
        { label: 'Security', value: 'Shielded', icon: Shield, color: 'text-green-400' },
        { label: 'Network', value: 'Active', icon: Activity, color: 'text-purple-400' },
    ], [profiles.length]);

    return (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            {stats.map((stat, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-2 opacity-5 -mr-2 -mt-2 group-hover:scale-150 transition-transform duration-700">
                        <stat.icon size={48} />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                        <stat.icon size={16} className={`${stat.color} opacity-80`} />
                        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold opacity-60">{stat.label}</span>
                    </div>
                    <div className="text-xl font-black text-[var(--text-main)]">{stat.value}</div>
                </div>
            ))}
        </section>
    );
};
