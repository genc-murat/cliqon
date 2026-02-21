import React from 'react';
import { X, Palette, Terminal as TerminalIcon, Type } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { terminalFontFamilies } from '../../lib/themes';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { availableThemes, setTheme, theme, availableTerminalThemes, terminalTheme, setTerminalTheme, terminalFont, setTerminalFont } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-sidebar)]">
                    <h2 className="text-lg font-semibold text-[var(--text-main)]">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1 rounded-md hover:bg-[var(--hover-color)]"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto max-h-[70vh]">
                    <div className="space-y-6">
                        {/* Tema Ayarları */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <Palette size={18} className="text-[var(--accent-color)]" />
                                <h3 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider">Appearance & Theme</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableThemes.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTheme(t.id)}
                                        className={`
                                            flex items-center justify-between p-3 rounded-lg border text-left transition-all
                                            ${theme.id === t.id
                                                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 ring-1 ring-[var(--accent-color)] ring-opacity-50'
                                                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)]'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-5 h-5 rounded-full border border-black/20"
                                                style={{ backgroundColor: t.colors.bgPrimary }}
                                            />
                                            <span className="text-sm font-medium text-[var(--text-main)]">{t.name}</span>
                                        </div>
                                        {theme.id === t.id && (
                                            <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-3 text-xs text-[var(--text-muted)]">
                                Your selected theme will instantly apply to all application windows and terminal tabs.
                            </p>
                        </section>

                        {/* Terminal Theme Settings */}
                        <section className="mt-6 border-t border-[var(--border-color)] pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <TerminalIcon size={18} className="text-[var(--accent-color)]" />
                                <h3 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider">Terminal Theme</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableTerminalThemes.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTerminalTheme(t.id)}
                                        className={`
                                            flex flex-col p-3 rounded-lg border text-left transition-all
                                            ${terminalTheme.id === t.id
                                                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 ring-1 ring-[var(--accent-color)] ring-opacity-50'
                                                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)]'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-between w-full mb-2">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded-full border border-black/20"
                                                    style={{ backgroundColor: t.id === 'appTheme' ? 'var(--bg-primary)' : t.colors.background }}
                                                />
                                                <span className="text-sm font-medium text-[var(--text-main)]">{t.name}</span>
                                            </div>
                                            {terminalTheme.id === t.id && (
                                                <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />
                                            )}
                                        </div>

                                        {/* ANSI Palette Preview */}
                                        <div className="flex gap-1 mt-1">
                                            {['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].map((c) => (
                                                <div
                                                    key={c}
                                                    className="w-2.5 h-1.5 rounded-full border border-black/10"
                                                    style={{ backgroundColor: (t.colors as any)[c] }}
                                                />
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Terminal Font Settings */}
                        <section className="mt-6 border-t border-[var(--border-color)] pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Type size={18} className="text-[var(--accent-color)]" />
                                <h3 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider">Terminal Font</h3>
                            </div>

                            <div className="space-y-4">
                                {/* Font Family */}
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Font Family</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {terminalFontFamilies.map((f) => (
                                            <button
                                                key={f.id}
                                                onClick={() => setTerminalFont({ fontFamily: f.value })}
                                                className={`p-2.5 rounded-lg border text-left text-sm transition-all truncate ${terminalFont.fontFamily === f.value
                                                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 ring-1 ring-[var(--accent-color)]'
                                                    : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--text-muted)]'
                                                    }`}
                                                style={{ fontFamily: f.value }}
                                            >
                                                {f.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-[var(--text-muted)] mb-2">
                                        <span>Font Size</span>
                                        <span className="text-[var(--text-main)] font-mono">{terminalFont.fontSize}px</span>
                                    </label>
                                    <input
                                        type="range" min={10} max={24} step={1}
                                        value={terminalFont.fontSize}
                                        onChange={(e) => setTerminalFont({ fontSize: Number(e.target.value) })}
                                        className="w-full accent-[var(--accent-color)]"
                                    />
                                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                                        <span>10px</span><span>24px</span>
                                    </div>
                                </div>

                                {/* Line Height */}
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-[var(--text-muted)] mb-2">
                                        <span>Line Height</span>
                                        <span className="text-[var(--text-main)] font-mono">{terminalFont.lineHeight.toFixed(1)}</span>
                                    </label>
                                    <input
                                        type="range" min={1} max={2} step={0.1}
                                        value={terminalFont.lineHeight}
                                        onChange={(e) => setTerminalFont({ lineHeight: Number(e.target.value) })}
                                        className="w-full accent-[var(--accent-color)]"
                                    />
                                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                                        <span>1.0</span><span>2.0</span>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div
                                    className="mt-2 p-3 rounded-md bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-xs"
                                    style={{ fontFamily: terminalFont.fontFamily, fontSize: `${terminalFont.fontSize}px`, lineHeight: terminalFont.lineHeight }}
                                >
                                    <span className="text-green-400">user@server</span>
                                    <span className="text-[var(--text-muted)]">:</span>
                                    <span className="text-blue-400">~</span>
                                    <span className="text-[var(--text-muted)]">$ </span>
                                    <span className="text-[var(--text-main)]">echo "Hello, Cliqon!"</span>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium rounded-md text-[var(--text-main)] bg-[var(--hover-color)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
