import React, { useState, useEffect } from 'react';
import { X, Palette, Terminal as TerminalIcon, Monitor, Info, Check, Activity, Shield, Zap, HardDrive, Key, Plus, Settings, RefreshCw, Users, Upload } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { Logo } from '../layout/Logo';
import { KeyStore } from '../settings/KeyStore';
import { useTheme } from '../../hooks/useTheme';
import { terminalFontFamilies } from '../../lib/themes';
import { exportAllData, importData as importDataFn, ExportData, getDatabaseStats } from '../../lib/db';
import { api } from '../../services/api';
import { useUpdater } from '../../hooks/useUpdater';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsSection = 'appearance' | 'terminal' | 'dashboard' | 'performance' | 'general' | 'keys' | 'snippets' | 'backup' | 'about';

interface DbStats {
    profiles: number;
    snippets: number;
    settings: number;
    panelStates: number;
    mlModels: number;
    backups: number;
    estimatedSize: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const {
        availableThemes, setTheme, theme,
        availableTerminalThemes, terminalTheme, setTerminalTheme,
        terminalFont, setTerminalFont,
        terminalCursorStyle, setTerminalCursorStyle,
        autoOpenMonitor, setAutoOpenMonitor,
        sessionTimeout, setSessionTimeout,
        terminalPerformance, setTerminalPerformance,
        dashboardQuickActions, setDashboardQuickActions
    } = useTheme();

    const { status: updateStatus, checkForUpdates, installUpdate, manifest, error: updateError } = useUpdater();

    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
    const [dbStats, setDbStats] = useState<DbStats | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadDbStats();
        }
    }, [isOpen]);

    const loadDbStats = async () => {
        try {
            const stats = await getDbStats();
            setDbStats(stats);
        } catch (e) {
            console.error('Failed to load db stats:', e);
        }
    };

    const getDbStats = async (): Promise<DbStats> => {
        return await getDatabaseStats();
    };

    const handleExport = async () => {
        try {
            const data = await exportAllData();
            const jsonString = JSON.stringify(data, null, 2);

            const filePath = await save({
                filters: [{
                    name: 'JSON',
                    extensions: ['json']
                }],
                defaultPath: `cliqon-backup-${new Date().toISOString().split('T')[0]}.json`
            });

            if (filePath) {
                await api.saveTextFile(filePath, jsonString);
                console.log('Export successful to:', filePath);
            }
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data: ExportData = JSON.parse(text);
            await importDataFn(data, 'merge');
            await loadDbStats();
        } catch (e) {
            console.error('Import failed:', e);
        }
        event.target.value = '';
    };

    if (!isOpen) return null;

    const navItems = [
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
        { id: 'dashboard', label: 'Dashboard', icon: Monitor },
        { id: 'performance', label: 'Performance', icon: Zap },
        { id: 'general', label: 'General', icon: Monitor },
        { id: 'keys', label: 'Keys', icon: Key },
        { id: 'snippets', label: 'Snippets', icon: Zap },
        { id: 'backup', label: 'Backup', icon: HardDrive },
        { id: 'about', label: 'About', icon: Info },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-4xl h-[600px] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-sidebar)] shrink-0">
                    <div className="flex items-center gap-3">
                        <Logo size={32} />
                        <h2 className="text-xl font-bold text-[var(--text-main)]">Preferences</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-2 rounded-xl hover:bg-[var(--hover-color)]"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Nav */}
                    <div className="w-52 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col p-3 gap-1 shrink-0">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id as SettingsSection)}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                                    ${activeSection === item.id
                                        ? 'bg-[var(--accent-color)] text-white shadow-lg shadow-[var(--accent-color)]/20 scale-[1.02]'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--hover-color)] hover:text-[var(--text-main)]'}
                                `}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
                        {activeSection === 'appearance' && (
                            <section className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Application Theme</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Personalize the look and feel of Cliqon with our curated themes.</p>

                                    <div className="space-y-8">
                                        <div>
                                            <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Dark Themes</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                {availableThemes.filter(t => t.type === 'dark').map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setTheme(t.id)}
                                                        className={`
                                                            group relative flex flex-col p-4 rounded-2xl border-2 text-left transition-all duration-300
                                                            ${theme.id === t.id
                                                                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 ring-4 ring-[var(--accent-color)]/5'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-primary)]'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex gap-2">
                                                                <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10" style={{ backgroundColor: t.colors.bgPrimary }} />
                                                                <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10" style={{ backgroundColor: t.colors.accent }} />
                                                            </div>
                                                            {theme.id === t.id && (
                                                                <div className="w-5 h-5 rounded-full bg-[var(--accent-color)] flex items-center justify-center shadow-md">
                                                                    <Check size={12} className="text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-bold text-[var(--text-main)] truncate">{t.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Light Themes</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                {availableThemes.filter(t => t.type === 'light').map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setTheme(t.id)}
                                                        className={`
                                                            group relative flex flex-col p-4 rounded-2xl border-2 text-left transition-all duration-300
                                                            ${theme.id === t.id
                                                                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 ring-4 ring-[var(--accent-color)]/5'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-primary)]'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex gap-2">
                                                                <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10" style={{ backgroundColor: t.colors.bgPrimary }} />
                                                                <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10" style={{ backgroundColor: t.colors.accent }} />
                                                            </div>
                                                            {theme.id === t.id && (
                                                                <div className="w-5 h-5 rounded-full bg-[var(--accent-color)] flex items-center justify-center shadow-md">
                                                                    <Check size={12} className="text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-bold text-[var(--text-main)] truncate">{t.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeSection === 'dashboard' && (
                            <section className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Dashboard Settings</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Customize the content and behavior of your dashboard.</p>

                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Quick Actions</h4>
                                            <p className="text-xs text-[var(--text-muted)] mb-4">Select which actions you want to see on your dashboard.</p>

                                            <div className="grid grid-cols-1 gap-3">
                                                {[
                                                    { id: 'new-connection', label: 'New Connection', icon: Plus },
                                                    { id: 'sharing', label: 'Network Sharing', icon: Users },
                                                    { id: 'import', label: 'Import Connections', icon: Upload },
                                                    { id: 'keys', label: 'Key Manager', icon: Key },
                                                    { id: 'settings', label: 'Settings', icon: Settings },
                                                    { id: 'updates', label: 'Check for Updates', icon: RefreshCw },
                                                ].map((action) => {
                                                    const isActive = dashboardQuickActions.includes(action.id);
                                                    return (
                                                        <div
                                                            key={action.id}
                                                            className="flex items-center justify-between p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--text-muted)] transition-all group"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="p-2 bg-[var(--accent-color)]/10 rounded-xl text-[var(--accent-color)]">
                                                                    <action.icon size={20} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-[var(--text-main)]">{action.label}</h4>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    if (isActive) {
                                                                        setDashboardQuickActions(dashboardQuickActions.filter(id => id !== action.id));
                                                                    } else {
                                                                        setDashboardQuickActions([...dashboardQuickActions, action.id]);
                                                                    }
                                                                }}
                                                                className={`
                                                                    relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none
                                                                    ${isActive ? 'bg-[var(--accent-color)]' : 'bg-[var(--hover-color)]'}
                                                                `}
                                                            >
                                                                <div className={`
                                                                    absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                                                                    ${isActive ? 'translate-x-6' : 'translate-x-0'}
                                                                `} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                        {activeSection === 'terminal' && (
                            <section className="space-y-10 max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
                                {/* Terminal Colors */}
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Terminal Colors</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Choose a palette for your terminal sessions.</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {availableTerminalThemes.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => setTerminalTheme(t.id)}
                                                className={`
                                                    p-4 rounded-2xl border-2 text-left transition-all duration-300
                                                    ${terminalTheme.id === t.id
                                                        ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                                                        : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)]'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center justify-between w-full mb-3">
                                                    <span className="text-sm font-bold text-[var(--text-main)]">{t.name}</span>
                                                    {terminalTheme.id === t.id && <Check size={14} className="text-[var(--accent-color)]" />}
                                                </div>

                                                <div className="flex gap-1.5 p-2 bg-black/20 rounded-xl overflow-hidden">
                                                    {['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].map((c) => (
                                                        <div
                                                            key={c}
                                                            className="flex-1 h-2 rounded-full"
                                                            style={{ backgroundColor: (t.colors as any)[c] }}
                                                        />
                                                    ))}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Typography */}
                                <div className="pt-6 border-t border-[var(--border-color)]">
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-6">Typography</h3>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-[var(--text-muted)] mb-3">Font Family</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {terminalFontFamilies.map((f) => (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => setTerminalFont({ fontFamily: f.value })}
                                                        className={`p-3 rounded-xl border-2 text-left text-sm transition-all truncate ${terminalFont.fontFamily === f.value
                                                            ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                                                            : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)]'
                                                            }`}
                                                        style={{ fontFamily: f.value }}
                                                    >
                                                        {f.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-sm font-semibold text-[var(--text-muted)]">Font Size</label>
                                                    <span className="text-xs font-mono bg-[var(--hover-color)] px-2 py-0.5 rounded text-[var(--text-main)]">{terminalFont.fontSize}px</span>
                                                </div>
                                                <input
                                                    type="range" min={10} max={24} step={1}
                                                    value={terminalFont.fontSize}
                                                    onChange={(e) => setTerminalFont({ fontSize: Number(e.target.value) })}
                                                    className="w-full accent-[var(--accent-color)] h-1.5 bg-[var(--hover-color)] rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-sm font-semibold text-[var(--text-muted)]">Line Height</label>
                                                    <span className="text-xs font-mono bg-[var(--hover-color)] px-2 py-0.5 rounded text-[var(--text-main)]">{terminalFont.lineHeight.toFixed(1)}</span>
                                                </div>
                                                <input
                                                    type="range" min={1} max={2} step={0.1}
                                                    value={terminalFont.lineHeight}
                                                    onChange={(e) => setTerminalFont({ lineHeight: Number(e.target.value) })}
                                                    className="w-full accent-[var(--accent-color)] h-1.5 bg-[var(--hover-color)] rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Cursor Style */}
                                <div className="pt-6 border-t border-[var(--border-color)]">
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Cursor Controls</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">How the cursor appears in your terminal sessions.</p>

                                    <div className="flex gap-4">
                                        {(['block', 'underline', 'bar'] as const).map((style) => (
                                            <button
                                                key={style}
                                                onClick={() => setTerminalCursorStyle(style)}
                                                className={`
                                                    flex-1 flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all
                                                    ${terminalCursorStyle === style
                                                        ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                                                        : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)]'}
                                                `}
                                            >
                                                <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center">
                                                    {style === 'block' && <div className="w-3 h-5 bg-[var(--accent-color)]" />}
                                                    {style === 'underline' && <div className="w-4 h-0.5 bg-[var(--accent-color)] mt-4" />}
                                                    {style === 'bar' && <div className="w-0.5 h-5 bg-[var(--accent-color)]" />}
                                                </div>
                                                <span className="text-xs font-bold capitalize">{style}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="mt-8 relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent-color)] to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                                    <div
                                        className="relative p-6 rounded-xl bg-black/90 border border-white/5 shadow-2xl overflow-hidden"
                                        style={{ fontFamily: terminalFont.fontFamily, fontSize: `${terminalFont.fontSize}px`, lineHeight: terminalFont.lineHeight }}
                                    >
                                        <div className="flex gap-1.5 mb-4">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex gap-2">
                                                <span className="text-emerald-400 font-bold">murat@cliqon</span>
                                                <span className="text-white/40">:</span>
                                                <span className="text-sky-400">~</span>
                                                <span className="text-white/40">$</span>
                                                <span className="text-white">ls -la</span>
                                            </div>
                                            <div className="text-white/60">total 42</div>
                                            <div className="text-white/60">drwxr-xr-x  2 murat murat  4096 Feb 21 18:55 .</div>
                                            <div className="text-white/60">drwxr-xr-x 20 murat murat  4096 Feb 21 18:50 ..</div>
                                            <div className="flex gap-2">
                                                <span className="text-emerald-400 font-bold">murat@cliqon</span>
                                                <span className="text-white/40">:</span>
                                                <span className="text-sky-400">~</span>
                                                <span className="text-white/40">$</span>
                                                <span className="inline-flex items-center">
                                                    <span className="text-white">whoami</span>
                                                    {terminalCursorStyle === 'block' && <span className="ml-1 w-2 h-4 bg-[var(--accent-color)] animate-pulse" />}
                                                    {terminalCursorStyle === 'underline' && <span className="ml-1 w-3 h-0.5 bg-[var(--accent-color)] self-end mb-1 animate-pulse" />}
                                                    {terminalCursorStyle === 'bar' && <span className="ml-0.5 w-0.5 h-4 bg-[var(--accent-color)] animate-pulse" />}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeSection === 'snippets' && (
                            <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Global Snippets</h3>
                                        <p className="text-sm text-[var(--text-muted)]">Manage snippets available across all connections.</p>
                                    </div>
                                    <button
                                        onClick={() => window.dispatchEvent(new CustomEvent('cliqon:toggle-snippets'))}
                                        className="px-4 py-2 bg-[var(--accent-color)] text-white text-xs font-bold rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                                    >
                                        <Zap size={14} /> View in Sidebar
                                    </button>
                                </div>

                                <div className="p-6 border border-[var(--border-color)] rounded-2xl bg-[var(--bg-sidebar)]/50">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Info size={16} className="text-[var(--accent-color)]" />
                                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                            Snippets are synchronized across all your terminal instances. You can also view and run them quickly using the right sidebar or the Command Palette (Ctrl+K).
                                        </p>
                                    </div>

                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-[var(--accent-color)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Zap size={32} className="text-[var(--accent-color)]" />
                                        </div>
                                        <h4 className="text-sm font-bold text-[var(--text-main)] mb-2">Centralized Snippet Management</h4>
                                        <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto mb-6">
                                            Manage your common commands and scripts in one place.
                                        </p>
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">
                                            Use the sidebar for quick access
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeSection === 'performance' && (
                            <section className="space-y-8 max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Terminal Performance</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Optimize terminal rendering for your system.</p>

                                    <div className="space-y-4">
                                        <div className="p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl">
                                            <div className="flex justify-between mb-3">
                                                <label className="text-sm font-semibold text-[var(--text-main)]">Scrollback Buffer</label>
                                                <span className="text-xs font-mono bg-[var(--hover-color)] px-2 py-0.5 rounded text-[var(--text-main)]">
                                                    {terminalPerformance.scrollbackMode === 'unlimited' ? 'Unlimited' : `${terminalPerformance.scrollbackLines.toLocaleString()} lines`}
                                                </span>
                                            </div>
                                            <div className="flex gap-3 items-center">
                                                <select
                                                    value={terminalPerformance.scrollbackMode}
                                                    onChange={(e) => setTerminalPerformance({ scrollbackMode: e.target.value as 'limited' | 'unlimited' })}
                                                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] text-sm rounded-lg px-3 py-2 outline-none"
                                                >
                                                    <option value="limited">Limited</option>
                                                    <option value="unlimited">Unlimited</option>
                                                </select>
                                                {terminalPerformance.scrollbackMode === 'limited' && (
                                                    <input
                                                        type="range" min={1000} max={100000} step={1000}
                                                        value={terminalPerformance.scrollbackLines}
                                                        onChange={(e) => setTerminalPerformance({ scrollbackLines: Number(e.target.value) })}
                                                        className="flex-1 accent-[var(--accent-color)] h-1.5 bg-[var(--hover-color)] rounded-lg appearance-none cursor-pointer"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl">
                                            <div className="flex justify-between mb-3">
                                                <label className="text-sm font-semibold text-[var(--text-main)]">Renderer</label>
                                            </div>
                                            <div className="flex gap-2">
                                                {(['auto', 'webgl', 'canvas'] as const).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setTerminalPerformance({ rendererMode: mode })}
                                                        className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${terminalPerformance.rendererMode === mode
                                                            ? 'bg-[var(--accent-color)] text-white'
                                                            : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                                            }`}
                                                    >
                                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-[var(--text-muted)] mt-2">
                                                WebGL provides better performance. Canvas is more compatible.
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl">
                                            <div>
                                                <h4 className="text-sm font-bold text-[var(--text-main)]">Show FPS Counter</h4>
                                                <p className="text-xs text-[var(--text-muted)]">Display rendering stats in terminal corner</p>
                                            </div>
                                            <button
                                                onClick={() => setTerminalPerformance({ showFpsCounter: !terminalPerformance.showFpsCounter })}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${terminalPerformance.showFpsCounter ? 'bg-[var(--accent-color)]' : 'bg-[var(--hover-color)]'
                                                    }`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${terminalPerformance.showFpsCounter ? 'translate-x-6' : 'translate-x-0'
                                                    }`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-[var(--border-color)]">
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-4">Storage Stats</h3>
                                    {dbStats && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl">
                                                <div className="text-xs text-[var(--text-muted)]">Profiles</div>
                                                <div className="text-lg font-bold text-[var(--text-main)]">{dbStats.profiles}</div>
                                            </div>
                                            <div className="p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl">
                                                <div className="text-xs text-[var(--text-muted)]">Snippets</div>
                                                <div className="text-lg font-bold text-[var(--text-main)]">{dbStats.snippets}</div>
                                            </div>
                                            <div className="p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl">
                                                <div className="text-xs text-[var(--text-muted)]">ML Models</div>
                                                <div className="text-lg font-bold text-[var(--text-main)]">{dbStats.mlModels}</div>
                                            </div>
                                            <div className="p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl">
                                                <div className="text-xs text-[var(--text-muted)]">Estimated Size</div>
                                                <div className="text-lg font-bold text-[var(--text-main)]">
                                                    {dbStats.estimatedSize > 1024 * 1024
                                                        ? `${(dbStats.estimatedSize / 1024 / 1024).toFixed(1)} MB`
                                                        : `${(dbStats.estimatedSize / 1024).toFixed(1)} KB`}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {activeSection === 'general' && (
                            <section className="space-y-8 max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Session Behaviors</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Configure how new terminal sessions behave.</p>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--text-muted)] transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-[var(--accent-color)]/10 rounded-xl text-[var(--accent-color)]">
                                                    <Activity size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-[var(--text-main)]">Auto-open Server Monitor</h4>
                                                    <p className="text-xs text-[var(--text-muted)]">Automatically open the health dashboard on connection</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setAutoOpenMonitor(!autoOpenMonitor)}
                                                className={`
                                                    relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none
                                                    ${autoOpenMonitor ? 'bg-[var(--accent-color)]' : 'bg-[var(--hover-color)]'}
                                                `}
                                            >
                                                <div className={`
                                                    absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                                                    ${autoOpenMonitor ? 'translate-x-6' : 'translate-x-0'}
                                                `} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--text-muted)] transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-[var(--accent-color)]/10 rounded-xl text-[var(--accent-color)]">
                                                    <Shield size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-[var(--text-main)]">Session Timeout</h4>
                                                    <p className="text-xs text-[var(--text-muted)]">Lock app and close connections after inactivity</p>
                                                </div>
                                            </div>
                                            <select
                                                value={sessionTimeout}
                                                onChange={(e) => setSessionTimeout(Number(e.target.value))}
                                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-medium rounded-xl focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent block p-2 outline-none cursor-pointer hover:border-[var(--text-muted)] transition-colors"
                                            >
                                                <option value={0}>Never</option>
                                                <option value={5}>5 Minutes</option>
                                                <option value={15}>15 Minutes</option>
                                                <option value={30}>30 Minutes</option>
                                                <option value={60}>1 Hour</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeSection === 'keys' && <KeyStore />}

                        {activeSection === 'backup' && (
                            <section className="space-y-8 max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Backup & Restore</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Export or import your Cliqon data.</p>

                                    <div className="space-y-4">
                                        <div className="p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl">
                                            <h4 className="text-sm font-bold text-[var(--text-main)] mb-2">Export Data</h4>
                                            <p className="text-xs text-[var(--text-muted)] mb-4">Download all your profiles, snippets, and settings as a JSON file.</p>
                                            <button
                                                onClick={handleExport}
                                                className="px-4 py-2 text-sm font-medium rounded-xl text-white bg-[var(--accent-color)] hover:opacity-90 transition-all"
                                            >
                                                Export All Data
                                            </button>
                                        </div>

                                        <div className="p-4 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl">
                                            <h4 className="text-sm font-bold text-[var(--text-main)] mb-2">Import Data</h4>
                                            <p className="text-xs text-[var(--text-muted)] mb-4">Restore data from a previously exported backup file.</p>
                                            <label className="px-4 py-2 text-sm font-medium rounded-xl text-[var(--text-main)] bg-[var(--hover-color)] hover:bg-[var(--border-color)] cursor-pointer transition-all inline-block">
                                                Import from File
                                                <input
                                                    type="file"
                                                    accept=".json"
                                                    onChange={handleImport}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {dbStats && (
                                    <div className="pt-6 border-t border-[var(--border-color)]">
                                        <h3 className="text-lg font-bold text-[var(--text-main)] mb-4">What will be exported</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                                <span className="text-[var(--text-muted)]">SSH Profiles</span>
                                                <span className="font-medium text-[var(--text-main)]">{dbStats.profiles}</span>
                                            </div>
                                            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                                <span className="text-[var(--text-muted)]">Global Snippets</span>
                                                <span className="font-medium text-[var(--text-main)]">{dbStats.snippets}</span>
                                            </div>
                                            <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                                <span className="text-[var(--text-muted)]">ML Models (Autocomplete)</span>
                                                <span className="font-medium text-[var(--text-main)]">{dbStats.mlModels}</span>
                                            </div>
                                            <div className="flex justify-between py-2">
                                                <span className="text-[var(--text-muted)]">Settings</span>
                                                <span className="font-medium text-[var(--text-main)]">{dbStats.settings}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-4">
                                            Note: Passwords and private keys are stored securely in your OS keyring and cannot be exported.
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}

                        {activeSection === 'about' && (
                            <section className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-500">
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-gradient-to-br from-[var(--accent-color)] to-purple-600 rounded-full blur-2xl opacity-20"></div>
                                    <div className="relative w-24 h-24 bg-gradient-to-br from-[var(--accent-color)] to-purple-600 rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3">
                                        <Logo size={48} className="-rotate-3" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tighter">Cliqon</h3>
                                    <p className="text-sm text-[var(--text-muted)] font-medium mt-1">Terminal of the future, today.</p>
                                </div>
                                <div className="space-y-2 pt-4">
                                    <div className="px-4 py-2 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-full text-xs font-bold text-[var(--text-main)] shadow-sm">
                                        Version 0.9.2
                                    </div>

                                    <div className="pt-4 flex flex-col items-center gap-3">
                                        {updateStatus === 'available' ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <p className="text-xs font-bold text-[var(--accent-color)] animate-bounce">
                                                    New version {manifest?.version} is available!
                                                </p>
                                                <button
                                                    onClick={installUpdate}
                                                    className="px-6 py-2 rounded-xl bg-[var(--accent-color)] text-white text-sm font-bold shadow-lg shadow-[var(--accent-color)]/20 hover:opacity-90 transition-all active:scale-95"
                                                >
                                                    Install Update & Restart
                                                </button>
                                            </div>
                                        ) : updateStatus === 'downloading' ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-xs text-[var(--text-muted)]">Downloading update...</p>
                                            </div>
                                        ) : updateStatus === 'checking' ? (
                                            <p className="text-xs text-[var(--text-muted)] animate-pulse">Checking for updates...</p>
                                        ) : (
                                            <button
                                                onClick={() => checkForUpdates()}
                                                className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors underline underline-offset-4"
                                            >
                                                Check for updates
                                            </button>
                                        )}
                                        {updateStatus === 'up-to-date' && (
                                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">You are on the latest version</p>
                                        )}
                                        {updateStatus === 'error' && (
                                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Update check failed: {updateError}</p>
                                        )}
                                    </div>

                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Made with ❤️ for developers</p>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-2.5 text-sm font-bold rounded-xl text-white bg-[var(--accent-color)] hover:opacity-90 shadow-lg shadow-[var(--accent-color)]/20 transition-all active:scale-95"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};
