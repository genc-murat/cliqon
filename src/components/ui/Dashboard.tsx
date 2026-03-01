import React, { useMemo } from 'react';
import { SshProfile } from '../../types/connection';
import { Logo } from '../layout/Logo';
import { useTheme } from '../../hooks/useTheme';
import { useSnippetsContext } from '../../contexts/SnippetsContext';
import {
    Rocket,
    Settings,
    Terminal as TerminalIcon,
    Clock,
    Plus,
    Cpu,
    Shield,
    Globe,
    Monitor,
    HelpCircle,
    Zap,
    Key,
    RefreshCw,
    Users,
    Upload
} from 'lucide-react';

interface DashboardProps {
    profiles: SshProfile[];
    onConnect: (profile: SshProfile) => void;
    onNewConnection: () => void;
    onOpenSettings: () => void;
    onViewAll: () => void;
    onToggleSharing: () => void;
    onOpenImport: () => void;
    onCheckUpdates?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    profiles,
    onConnect,
    onNewConnection,
    onOpenSettings,
    onViewAll,
    onToggleSharing,
    onOpenImport,
    onCheckUpdates
}) => {
    const { dashboardQuickActions } = useTheme();
    const { snippets } = useSnippetsContext();

    const recentProfiles = useMemo(() => {
        return [...profiles]
            .filter(p => p.last_used)
            .sort((a, b) => (b.last_used || 0) - (a.last_used || 0))
            .slice(0, 4);
    }, [profiles]);

    const recentSnippets = useMemo(() => {
        return [...snippets].slice(0, 4);
    }, [snippets]);

    const stats = useMemo(() => [
        { label: 'Total Profiles', value: profiles.length, icon: Globe, color: 'text-blue-400' },
        { label: 'System Status', value: 'Ready', icon: Shield, color: 'text-green-400' },
        { label: 'Active Sessions', value: 0, icon: Cpu, color: 'text-purple-400' },
    ], [profiles.length]);

    return (
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] p-8 md:p-12 lg:p-16">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Hero Section */}
                <section className="flex flex-col md:flex-row items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="p-1 rounded-2xl bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 shadow-2xl shadow-blue-500/20">
                        <div className="bg-[var(--bg-primary)] p-6 rounded-[calc(1rem-1px)]">
                            <Logo size={80} className="text-[var(--accent-primary)]" />
                        </div>
                    </div>
                    <div className="text-center md:text-left space-y-2">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Welcome to Cliqon
                        </h1>
                        <p className="text-lg text-[var(--text-muted)] max-w-xl">
                            Modern, fast, and secure SSH client for the future. Manage your servers with ease and style.
                        </p>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Column */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Recent Connections */}
                        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-100">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Clock size={20} className="text-blue-400" />
                                    Recent Connections
                                </h2>
                                {profiles.length > 0 && (
                                    <button
                                        onClick={onViewAll}
                                        className="text-sm text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                                    >
                                        View all profiles
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {recentProfiles.length > 0 ? (
                                    recentProfiles.map((profile) => (
                                        <button
                                            key={profile.id}
                                            onClick={() => onConnect(profile)}
                                            className="group relative flex items-start gap-4 p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 text-left"
                                        >
                                            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-blue-400 group-hover:scale-110 transition-transform duration-300">
                                                <TerminalIcon size={24} style={{ color: profile.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium truncate">{profile.name}</h3>
                                                <p className="text-xs text-[var(--text-muted)] truncate">{profile.username}@{profile.host}</p>
                                                <p className="text-[10px] text-[var(--text-muted)] mt-1 opacity-60">
                                                    Last used: {new Date((profile.last_used || 0) * 1000).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Rocket size={16} className="text-[var(--accent-primary)]" />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-[var(--text-muted)] bg-white/[0.02]">
                                        <Monitor size={48} className="opacity-20 mb-4" />
                                        <p className="text-sm">No recent connections found.</p>
                                        <button
                                            onClick={onNewConnection}
                                            className="mt-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium transition-all"
                                        >
                                            Start your first session
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Recent Snippets */}
                        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-150">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Zap size={20} className="text-yellow-400" />
                                    Recent Snippets
                                </h2>
                                {snippets.length > 0 && (
                                    <button
                                        onClick={() => window.dispatchEvent(new CustomEvent('cliqon:toggle-snippets'))}
                                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                    >
                                        Manage snippets
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {recentSnippets.length > 0 ? (
                                    recentSnippets.map((snippet) => (
                                        <div
                                            key={snippet.id}
                                            className="group relative flex items-start gap-4 p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 text-left"
                                        >
                                            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-yellow-400">
                                                <Zap size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium truncate">{snippet.name}</h3>
                                                <p className="text-xs text-[var(--text-muted)] truncate opacity-60 font-mono mt-1">{snippet.command.slice(0, 50)}...</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-[var(--text-muted)] bg-white/[0.02]">
                                        <p className="text-sm italic">No snippets created yet.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Stats Grid */}
                        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-200">
                            {stats.map((stat, i) => (
                                <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
                                    <stat.icon size={20} className={stat.color} />
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold opacity-60">{stat.label}</div>
                                </div>
                            ))}
                        </section>

                    </div>

                    {/* Sidebar Column */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">

                        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
                            <h2 className="text-lg font-semibold">Quick Actions</h2>
                            <div className="space-y-3">
                                {dashboardQuickActions.includes('new-connection') && (
                                    <button
                                        onClick={onNewConnection}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--accent-primary)] text-white hover:brightness-110 transition-all shadow-lg shadow-blue-500/20 font-medium"
                                    >
                                        <Plus size={18} />
                                        New Connection
                                    </button>
                                )}
                                {dashboardQuickActions.includes('sharing') && (
                                    <button
                                        onClick={onToggleSharing}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
                                    >
                                        <Users size={18} />
                                        Network Sharing
                                    </button>
                                )}
                                {dashboardQuickActions.includes('import') && (
                                    <button
                                        onClick={onOpenImport}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
                                    >
                                        <Upload size={18} />
                                        Import Connections
                                    </button>
                                )}
                                {dashboardQuickActions.includes('keys') && (
                                    <button
                                        onClick={() => window.dispatchEvent(new CustomEvent('cliqon:open-settings', { detail: { section: 'keys' } }))}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
                                    >
                                        <Key size={18} />
                                        Key Manager
                                    </button>
                                )}
                                {dashboardQuickActions.includes('settings') && (
                                    <button
                                        onClick={onOpenSettings}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
                                    >
                                        <Settings size={18} />
                                        Settings
                                    </button>
                                )}
                                {dashboardQuickActions.includes('updates') && (
                                    <button
                                        onClick={onCheckUpdates}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
                                    >
                                        <RefreshCw size={18} />
                                        Check for Updates
                                    </button>
                                )}
                            </div>
                        </section>

                        {/* Shortcuts Guide */}
                        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)] opacity-60">
                                Shortcuts
                            </h2>
                            <div className="space-y-4">
                                {[
                                    { keys: ['Ctrl', 'N'], label: 'New Connection' },
                                    { keys: ['Ctrl', 'K'], label: 'Command Palette' },
                                    { keys: ['Ctrl', 'B'], label: 'Toggle SFTP' },
                                    { keys: ['Ctrl', 'Tab'], label: 'Switch Tabs' },
                                ].map((shortcut, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--text-muted)]">{shortcut.label}</span>
                                        <div className="flex gap-1">
                                            {shortcut.keys.map((key, ki) => (
                                                <kbd key={ki} className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-mono">
                                                    {key}
                                                </kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Help/Tips */}
                        <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-blue-200 text-xs leading-relaxed flex gap-4">
                            <HelpCircle size={24} className="shrink-0 text-blue-400" />
                            <p>
                                Did you know? You can right-click any connection in the sidebar to clone it or share it with others.
                            </p>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};
