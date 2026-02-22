import React, { useState } from 'react';
import { X, Palette, Terminal as TerminalIcon, Monitor, Info, Check, Activity, Shield } from 'lucide-react';
import { Logo } from '../layout/Logo';
import { useTheme } from '../../hooks/useTheme';
import { terminalFontFamilies } from '../../lib/themes';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsSection = 'appearance' | 'terminal' | 'general' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const {
        availableThemes, setTheme, theme,
        availableTerminalThemes, terminalTheme, setTerminalTheme,
        terminalFont, setTerminalFont,
        terminalCursorStyle, setTerminalCursorStyle,
        autoOpenMonitor, setAutoOpenMonitor,
        sessionTimeout, setSessionTimeout
    } = useTheme();

    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');

    if (!isOpen) return null;

    const navItems = [
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
        { id: 'general', label: 'General', icon: Monitor },
        { id: 'about', label: 'About', icon: Info },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all duration-300">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-4xl h-[600px] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

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
                    <div className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col p-3 gap-1 shrink-0">
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
                            <section className="space-y-8 max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Application Theme</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Personalize the look and feel of Cliqon with our curated themes.</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {availableThemes.map((t) => (
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
                                                <span className="text-sm font-bold text-[var(--text-main)]">{t.name}</span>
                                                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-tight mt-0.5">{t.type} Mode</span>
                                            </button>
                                        ))}
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

                                <div className="pt-8 border-t border-[var(--border-color)] flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                                    <div className="p-6 bg-[var(--hover-color)] rounded-full text-[var(--text-muted)]">
                                        <Monitor size={48} />
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--text-main)]">More Settings Coming Soon</h3>
                                    <p className="text-xs text-[var(--text-muted)] max-w-sm">System integrity and per-protocol behaviors will be configurable here.</p>
                                </div>
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
                                        Version 0.2.5
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
