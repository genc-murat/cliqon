import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search, Terminal, Palette, Settings,
    Activity, Box, Share2,
    Clock, List, Trash2, FolderSync, Command,
    Plus, Upload, RefreshCw, X, Columns2,
    ArrowLeftRight, Type, Zap,
    Monitor, Gauge, LogOut, LayoutGrid,
    Minus, MousePointerClick, Info
} from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { useTheme } from '../../hooks/useTheme';

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    category: 'Connections' | 'Themes' | 'Tools' | 'Application' | 'Terminal Settings' | 'View & Layout';
    action: () => void;
    shortcut?: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    profiles: SshProfile[];
    activeTabId: string | null;
    onConnect: (profile: SshProfile) => void;
    onToggleManagement: (type: any) => void;
    onClearTerminal: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    profiles,
    activeTabId,
    onConnect,
    onToggleManagement,
    onClearTerminal
}) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const {
        setTheme, theme: currentTheme,
        setTerminalCursorStyle, terminalCursorStyle,
        setTerminalFont, terminalFont,
        setTerminalPerformance, terminalPerformance,
        setAutoOpenMonitor, autoOpenMonitor
    } = useTheme();

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Build command list
    const allCommands = useMemo(() => {
        const commands: CommandItem[] = [];

        // --- Application ---
        commands.push({
            id: 'open-settings',
            label: 'Open Settings',
            description: 'Application configuration',
            icon: <Settings size={16} />,
            category: 'Application',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:open-settings')),
            shortcut: 'Ctrl+,'
        });

        commands.push({
            id: 'new-connection',
            label: 'New Connection',
            description: 'Create a new SSH profile',
            icon: <Plus size={16} />,
            category: 'Application',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:open-add-profile')),
            shortcut: 'Ctrl+N'
        });

        commands.push({
            id: 'import-connections',
            label: 'Import Connections',
            description: 'Restore from backup',
            icon: <Upload size={16} />,
            category: 'Application',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:open-import'))
        });

        commands.push({
            id: 'focus-search',
            label: 'Search Profiles',
            description: 'Focus sidebar search',
            icon: <Search size={16} />,
            category: 'Application',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:focus-search')),
            shortcut: 'Ctrl+F'
        });

        commands.push({
            id: 'check-updates',
            label: 'Check for Updates',
            icon: <RefreshCw size={16} />,
            category: 'Application',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:check-updates'))
        });

        commands.push({
            id: 'exit-app',
            label: 'Exit application',
            description: 'Close cliqon securely',
            icon: <LogOut size={16} />,
            category: 'Application',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:exit-app'))
        });

        // --- Themes ---
        commands.push({
            id: 'theme-dark',
            label: 'Modern Dark',
            description: currentTheme.id === 'modernDark' ? 'Current theme' : 'Select dark mode',
            icon: <Palette size={16} className="text-slate-400" />,
            category: 'Themes',
            action: () => setTheme('modernDark')
        });

        commands.push({
            id: 'theme-light',
            label: 'Modern Light',
            description: currentTheme.id === 'modernLight' ? 'Current theme' : 'Select light mode',
            icon: <Palette size={16} className="text-amber-400" />,
            category: 'Themes',
            action: () => setTheme('modernLight')
        });

        // --- View & Layout ---
        commands.push({
            id: 'toggle-sidebar',
            label: 'Toggle Sidebar',
            description: 'Collapse or expand the left panel',
            icon: <LayoutGrid size={16} />,
            category: 'View & Layout',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:toggle-sidebar'))
        });

        commands.push({
            id: 'switch-view-mode',
            label: 'Switch Sidebar View',
            description: 'Toggle Cards vs Compact view',
            icon: <List size={16} />,
            category: 'View & Layout',
            action: () => window.dispatchEvent(new CustomEvent('cliqon:switch-view-mode'))
        });

        if (activeTabId) {
            commands.push({
                id: 'toggle-snippets',
                label: 'Toggle Snippets Panel',
                description: 'Show/hide global snippets',
                icon: <Zap size={16} />,
                category: 'View & Layout',
                action: () => window.dispatchEvent(new CustomEvent('cliqon:toggle-snippets'))
            });

            commands.push({
                id: 'split-pane',
                label: 'Split Terminal',
                description: 'Open a horizontal pane',
                icon: <Columns2 size={16} />,
                category: 'View & Layout',
                action: () => window.dispatchEvent(new CustomEvent('cliqon:split-pane')),
                shortcut: 'Ctrl+Shift+H'
            });

            commands.push({
                id: 'close-tab',
                label: 'Close Active Tab',
                icon: <X size={16} />,
                category: 'View & Layout',
                action: () => window.dispatchEvent(new CustomEvent('cliqon:close-active-tab')),
                shortcut: 'Ctrl+W'
            });

            // Cycle Tabs
            commands.push({
                id: 'next-tab',
                label: 'Next Tab',
                icon: <ArrowLeftRight size={16} />,
                category: 'View & Layout',
                action: () => window.dispatchEvent(new CustomEvent('cliqon:next-tab')),
                shortcut: 'Ctrl+Tab'
            });

            // --- Terminal Settings ---
            const cursorStyles: ('block' | 'underline' | 'bar')[] = ['block', 'underline', 'bar'];
            cursorStyles.forEach(style => {
                commands.push({
                    id: `cursor-${style}`,
                    label: `Cursor: ${style.charAt(0).toUpperCase() + style.slice(1)}`,
                    description: terminalCursorStyle === style ? 'Currently selected' : `Change cursor to ${style}`,
                    icon: <MousePointerClick size={16} />,
                    category: 'Terminal Settings',
                    action: () => setTerminalCursorStyle(style)
                });
            });

            commands.push({
                id: 'font-inc',
                label: 'Increase Font Size',
                description: `Current: ${terminalFont.fontSize}px`,
                icon: <Plus size={16} />,
                category: 'Terminal Settings',
                action: () => setTerminalFont({ fontSize: terminalFont.fontSize + 1 })
            });

            commands.push({
                id: 'font-dec',
                label: 'Decrease Font Size',
                icon: <Minus size={16} />,
                category: 'Terminal Settings',
                action: () => setTerminalFont({ fontSize: Math.max(8, terminalFont.fontSize - 1) })
            });

            commands.push({
                id: 'font-reset',
                label: 'Reset Font Size',
                description: 'Set to default 14px',
                icon: <Type size={16} />,
                category: 'Terminal Settings',
                action: () => setTerminalFont({ fontSize: 14 })
            });

            commands.push({
                id: 'fps-toggle',
                label: 'Toggle FPS Counter',
                description: terminalPerformance.showFpsCounter ? 'Hide performance stats' : 'Show performance stats',
                icon: <Gauge size={16} />,
                category: 'Terminal Settings',
                action: () => setTerminalPerformance({ showFpsCounter: !terminalPerformance.showFpsCounter })
            });

            commands.push({
                id: 'monitor-auto-toggle',
                label: 'Toggle Auto-open Monitor',
                description: autoOpenMonitor ? 'Disable auto-open' : 'Enable auto-open monitor on connect',
                icon: <Monitor size={16} />,
                category: 'Terminal Settings',
                action: () => setAutoOpenMonitor(!autoOpenMonitor)
            });

            // --- Tools ---
            commands.push({
                id: 'clear-terminal',
                label: 'Clear Terminal',
                icon: <Trash2 size={16} />,
                category: 'Tools',
                action: onClearTerminal,
            });

            commands.push({
                id: 'toggle-sftp',
                label: 'Toggle SFTP Browser',
                icon: <FolderSync size={16} />,
                category: 'Tools',
                action: () => window.dispatchEvent(new CustomEvent('cliqon:toggle-sftp')),
                shortcut: 'Ctrl+B'
            });

            // Management Tools
            const tools: { id: any; label: string; icon: React.ReactNode }[] = [
                { id: 'monitor', label: 'Server Monitor', icon: <Activity size={16} /> },
                { id: 'docker', label: 'Docker Manager', icon: <Box size={16} /> },
                { id: 'env', label: 'Env Manager', icon: <List size={16} /> },
                { id: 'network', label: 'Network Tools', icon: <Share2 size={16} /> },
                { id: 'tunnels', label: 'SSH Tunnels', icon: <Terminal size={16} /> },
                { id: 'cron', label: 'Cron Manager', icon: <Clock size={16} /> },
                { id: 'keys', label: 'Remote Key Manager', icon: <Info size={16} /> },
            ];

            tools.forEach(tool => {
                commands.push({
                    id: `tool-${tool.id}`,
                    label: tool.label,
                    icon: tool.icon,
                    category: 'Tools',
                    action: () => onToggleManagement(tool.id)
                });
            });
        }

        // --- Connections ---
        profiles.forEach(p => {
            commands.push({
                id: `connect-${p.id}`,
                label: `SSH: ${p.name}`,
                description: `${p.username}@${p.host}`,
                icon: <Terminal size={16} style={p.color ? { color: p.color } : {}} />,
                category: 'Connections',
                action: () => onConnect(p)
            });
        });

        return commands;
    }, [profiles, currentTheme, activeTabId, onConnect, onToggleManagement, setTheme, onClearTerminal,
        setTerminalCursorStyle, terminalCursorStyle, setTerminalFont, terminalFont, setTerminalPerformance,
        terminalPerformance, setAutoOpenMonitor, autoOpenMonitor]);

    // Filtered results
    const filteredResults = useMemo(() => {
        if (!search) return allCommands;
        const s = search.toLowerCase();
        return allCommands.filter(c =>
            c.label.toLowerCase().includes(s) ||
            c.category.toLowerCase().includes(s) ||
            c.description?.toLowerCase().includes(s)
        ).sort((a, b) => {
            // Priority to exact match on label
            const aMatch = a.label.toLowerCase().startsWith(s) ? 0 : 1;
            const bMatch = b.label.toLowerCase().startsWith(s) ? 0 : 1;
            return aMatch - bMatch;
        });
    }, [search, allCommands]);

    useEffect(() => { setSelectedIndex(0); }, [search]);
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setSearch('');
        }
    }, [isOpen]);

    useEffect(() => {
        const activeItem = scrollRef.current?.querySelector('.active-command');
        if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedIndex]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % (filteredResults.length || 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + (filteredResults.length || 1)) % (filteredResults.length || 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filteredResults[selectedIndex];
                if (cmd) {
                    cmd.action();
                    onClose();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [isOpen, filteredResults, selectedIndex, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-black/20 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]/50">
                    <Search className="text-[var(--text-muted)]" size={18} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a command or search profiles..."
                        className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-muted)]">
                        <Command size={10} />
                        K
                    </div>
                </div>

                {/* Results List */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar"
                >
                    {filteredResults.length === 0 ? (
                        <div className="py-12 text-center">
                            <Search className="mx-auto mb-3 opacity-20" size={32} />
                            <p className="text-sm text-[var(--text-muted)]">No results found for "{search}"</p>
                        </div>
                    ) : (
                        filteredResults.map((cmd, idx) => (
                            <div
                                key={cmd.id}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all
                                    ${idx === selectedIndex ? 'bg-[var(--accent-color)] text-white active-command shadow-lg shadow-[var(--accent-color)]/20' : 'hover:bg-[var(--hover-color)] text-[var(--text-main)]'}
                                `}
                                onClick={() => {
                                    cmd.action();
                                    onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                <div className={`shrink-0 p-1.5 rounded-md ${idx === selectedIndex ? 'bg-white/20' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)]'}`}>
                                    {cmd.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium truncate">{cmd.label}</span>
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${idx === selectedIndex ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                                            {cmd.category}
                                        </span>
                                    </div>
                                    {cmd.description && (
                                        <div className={`text-[11px] truncate ${idx === selectedIndex ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                            {cmd.description}
                                        </div>
                                    )}
                                </div>
                                {cmd.shortcut && (
                                    <div className={`text-[10px] font-mono shrink-0 ${idx === selectedIndex ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                                        {cmd.shortcut}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Tips */}
                <div className="px-4 py-2 bg-[var(--bg-sidebar)]/30 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-muted)] font-medium">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">↑↓</span> to navigate</span>
                        <span className="flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">Enter</span> to select</span>
                        <span className="flex items-center gap-1"><span className="px-1 py-0.5 rounded bg-[var(--bg-primary)] border border(--border-color)]">Esc</span> to close</span>
                    </div>
                    <div>{filteredResults.length} commands found</div>
                </div>
            </div>
        </div>
    );
};
