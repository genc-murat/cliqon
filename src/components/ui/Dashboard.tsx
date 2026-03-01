import React from 'react';
import { SshProfile } from '../../types/connection';
import { Logo } from '../layout/Logo';
import { useTheme } from '../../hooks/useTheme';
import { useSnippetsContext } from '../../contexts/SnippetsContext';
import {
    Settings,
    Plus,
    Key,
    RefreshCw,
    Users,
    Upload,
    Activity,
    HelpCircle
} from 'lucide-react';
import {
    FavoritesWidget,
    RecentActivityWidget,
    SnippetMacrosWidget,
    SystemHealthWidget
} from '../dashboard/DashboardWidgets';

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
    const { dashboardQuickActions, dashboardWidgets } = useTheme();
    const { snippets } = useSnippetsContext();


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

                        {dashboardWidgets.includes('favorites') && (
                            <FavoritesWidget
                                profiles={profiles}
                                snippets={snippets}
                                onConnect={onConnect}
                                onViewAll={onViewAll}
                            />
                        )}

                        {dashboardWidgets.includes('recent') && (
                            <RecentActivityWidget
                                profiles={profiles}
                                snippets={snippets}
                                onConnect={onConnect}
                                onViewAll={onViewAll}
                            />
                        )}

                        {dashboardWidgets.includes('snippets') && (
                            <SnippetMacrosWidget
                                profiles={profiles}
                                snippets={snippets}
                                onConnect={onConnect}
                                onViewAll={onViewAll}
                            />
                        )}

                        {dashboardWidgets.includes('stats') && (
                            <SystemHealthWidget
                                profiles={profiles}
                                snippets={snippets}
                                onConnect={onConnect}
                                onViewAll={onViewAll}
                            />
                        )}

                        {/* Fallback if no widgets or just intro */}
                        {dashboardWidgets.length === 0 && (
                            <div className="py-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-[var(--text-muted)] bg-white/[0.02]">
                                <Activity size={48} className="opacity-20 mb-4" />
                                <p className="text-sm">Your dashboard is a clean slate.</p>
                                <button
                                    onClick={onOpenSettings}
                                    className="mt-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium transition-all"
                                >
                                    Customize Widgets
                                </button>
                            </div>
                        )}

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
