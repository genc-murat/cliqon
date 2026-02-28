import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Settings, Shield, TerminalSquare, Plus, Edit2, Trash2,
    Star, ChevronDown, Search, X, Folder,
    Upload, Key, Lock, Link, LayoutGrid, List, Zap,
    ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import { useConnections } from '../../hooks/useConnections';
import { ProfileModal } from '../ui/ProfileModal';
import { SettingsModal } from '../ui/SettingsModal';
import { useUpdater } from '../../hooks/useUpdater';
import { SshProfile, AuthMethod } from '../../types/connection';
import { useResizable } from '../../hooks/useResizable';
import { Logo } from './Logo';
import { ImportModal } from '../ui/ImportModal';
import { useSharing } from '../../contexts/SharingContext';
import { useConfirm } from '../../hooks/useConfirm';

/* ── Helpers ────────────────────────────────────────────────── */

const AUTH_META: Record<AuthMethod, { icon: React.ReactNode; label: string; cls: string }> = {
    PrivateKey: { icon: <Key size={10} />, label: 'Key', cls: 'auth-badge auth-badge--key' },
    Password: { icon: <Lock size={10} />, label: 'Pass', cls: 'auth-badge auth-badge--password' },
    Agent: { icon: <Link size={10} />, label: 'Agent', cls: 'auth-badge auth-badge--agent' },
};

/** Wrap matched text with <mark> for search highlighting */
const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
            {text.slice(idx + query.length)}
        </>
    );
};

/* ── Types ──────────────────────────────────────────────────── */

type ViewMode = 'cards' | 'compact';

interface SidebarProps {
    onConnect?: (profile: SshProfile) => void;
    openAddModalRef?: React.MutableRefObject<(() => void) | null>;
    focusSearchRef?: React.MutableRefObject<(() => void) | null>;
}

/* ── ConnectionCard ─────────────────────────────────────────── */

interface CardProps {
    profile: SshProfile;
    query: string;
    onConnect: () => void;
    onToggleFavorite: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

const ConnectionCard: React.FC<CardProps> = ({
    profile, query,
    onConnect, onToggleFavorite, onContextMenu
}) => {
    const auth = AUTH_META[profile.auth_method] ?? AUTH_META.Password;
    const hostStr = `${profile.username}@${profile.host}${profile.port !== 22 ? `:${profile.port}` : ''}`;
    const initial = profile.name.trim().charAt(0).toUpperCase() || '?';

    return (
        <div
            className="connection-card group"
            style={{ '--card-accent': profile.color || undefined } as React.CSSProperties}
            onClick={onConnect}
            onContextMenu={onContextMenu}
        >
            <div className="flex items-start gap-3">
                {/* Connection Icon / Avatar */}
                <div className="connection-icon">
                    {initial}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Row 1: Name + Actions */}
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-[var(--text-main)] truncate">
                            {highlightText(profile.name, query)}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                            <button
                                onClick={onToggleFavorite}
                                className="fav-star p-1 rounded-md hover:bg-[var(--hover-color)]"
                                title={profile.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <Star
                                    size={12}
                                    className={profile.is_favorite
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-[var(--text-muted)] hover:text-amber-400'}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Host info */}
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] text-[var(--text-muted)] truncate font-mono opacity-80">
                            {highlightText(hostStr, query)}
                        </span>
                    </div>

                    {/* Row 3: Auth badge + Quick Connect */}
                    <div className="flex items-center justify-between">
                        <span className={auth.cls}>
                            {auth.icon} {auth.label}
                        </span>
                        <button
                            className="quick-connect-btn flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold rounded-full bg-[var(--accent-color)] text-white hover:brightness-110 shadow-sm"
                            onClick={(e) => { e.stopPropagation(); onConnect(); }}
                            title="Quick Connect"
                        >
                            <Zap size={9} fill="currentColor" /> Connect
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── CompactRow ─────────────────────────────────────────────── */

interface CompactRowProps {
    profile: SshProfile;
    query: string;
    onConnect: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

const CompactRow: React.FC<CompactRowProps> = ({
    profile, query,
    onConnect, onContextMenu
}) => {
    const auth = AUTH_META[profile.auth_method] ?? AUTH_META.Password;

    return (
        <div
            className="connection-compact group relative"
            style={{
                borderLeftColor: profile.color || 'transparent',
            }}
            onClick={onConnect}
            onContextMenu={onContextMenu}
        >
            <div className="w-5 flex items-center justify-center shrink-0">
                {profile.is_favorite
                    ? <Star size={13} className="fill-amber-400 text-amber-400" />
                    : <Shield size={13} style={profile.color ? { color: profile.color } : {}} className="text-[var(--accent-color)]" />
                }
            </div>
            <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-[var(--text-main)] truncate block">
                    {highlightText(profile.name, query)}
                </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className={`${auth.cls} scale-90 hidden sm:inline-flex`}>
                    {auth.icon}
                </span>
                <button
                    className="quick-connect-btn p-1.5 rounded-md text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white transition-all shadow-sm"
                    onClick={(e) => { e.stopPropagation(); onConnect(); }}
                    title="Quick Connect"
                >
                    <Zap size={12} fill="currentColor" />
                </button>
            </div>
        </div>
    );
};

/* ── Sidebar ────────────────────────────────────────────────── */

export const Sidebar: React.FC<SidebarProps> = ({ onConnect, openAddModalRef, focusSearchRef }) => {
    const { profiles, isLoading, saveProfile, deleteProfile } = useConnections();
    const confirm = useConfirm();
    const { width, startResizing, isResizing } = useResizable(280, 160, 600, 'left', 'sidebar-width');
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { status: updateStatus } = useUpdater();
    const { togglePanel, isPanelOpen } = useSharing();
    const [editingProfile, setEditingProfile] = useState<SshProfile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>(() =>
        (localStorage.getItem('sidebar-view-mode') as ViewMode) || 'cards'
    );
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try { return JSON.parse(localStorage.getItem('sidebar-groups-collapsed') ?? '{}'); } catch { return {}; }
    });
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        profile?: SshProfile;
    } | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const existingGroups = Array.from(
        new Set(profiles.map(p => p.category).filter(Boolean) as string[])
    ).sort();

    const toggleGroup = (group: string) => {
        setCollapsedGroups(prev => {
            const next = { ...prev, [group]: !prev[group] };
            localStorage.setItem('sidebar-groups-collapsed', JSON.stringify(next));
            return next;
        });
    };

    const switchViewMode = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('sidebar-view-mode', mode);
    }, []);

    useEffect(() => {
        const handleOpenSettings = () => setIsSettingsOpen(true);
        const handleOpenAdd = () => handleAdd();
        const handleOpenImport = () => setIsImportModalOpen(true);
        const handleFocusSearch = () => {
            if (isCollapsed) {
                setIsCollapsed(false);
                localStorage.setItem('sidebar-collapsed', 'false');
                setTimeout(() => searchRef.current?.focus(), 220);
            } else {
                searchRef.current?.focus();
            }
        };
        const handleToggleSharing = () => togglePanel();
        const handleToggleSidebar = () => toggleCollapse();
        const handleSwitchViewMode = () => switchViewMode(viewMode === 'cards' ? 'compact' : 'cards');

        window.addEventListener('cliqon:open-settings', handleOpenSettings);
        window.addEventListener('cliqon:open-add-profile', handleOpenAdd);
        window.addEventListener('cliqon:open-import', handleOpenImport);
        window.addEventListener('cliqon:focus-search', handleFocusSearch);
        window.addEventListener('cliqon:toggle-sharing', handleToggleSharing);
        window.addEventListener('cliqon:toggle-sidebar', handleToggleSidebar);
        window.addEventListener('cliqon:switch-view-mode', handleSwitchViewMode);

        if (openAddModalRef) openAddModalRef.current = handleAdd;
        if (focusSearchRef) focusSearchRef.current = handleFocusSearch;

        return () => {
            window.removeEventListener('cliqon:open-settings', handleOpenSettings);
            window.removeEventListener('cliqon:open-add-profile', handleOpenAdd);
            window.removeEventListener('cliqon:open-import', handleOpenImport);
            window.removeEventListener('cliqon:focus-search', handleFocusSearch);
            window.removeEventListener('cliqon:toggle-sharing', handleToggleSharing);
            window.removeEventListener('cliqon:toggle-sidebar', handleToggleSidebar);
            window.removeEventListener('cliqon:switch-view-mode', handleSwitchViewMode);
        };
    }, [isCollapsed, viewMode, switchViewMode, togglePanel]);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('sidebar-collapsed', String(next));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };

    const q = searchQuery.toLowerCase().trim();
    const filteredProfiles = [...profiles]
        .filter(p =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.host.toLowerCase().includes(q) ||
            p.username.toLowerCase().includes(q)
        )
        .sort((a, b) => {
            const aFav = a.is_favorite ? 1 : 0;
            const bFav = b.is_favorite ? 1 : 0;
            if (bFav !== aFav) return bFav - aFav;
            return a.name.localeCompare(b.name);
        });

    const groupedView = !q;
    const groups: { label: string; items: SshProfile[]; isFavorite?: boolean }[] = [];
    if (groupedView) {
        const favorites = filteredProfiles.filter(p => p.is_favorite);
        const others = filteredProfiles.filter(p => !p.is_favorite);

        if (favorites.length > 0) {
            groups.push({ label: 'Favorites', items: favorites, isFavorite: true });
        }

        const byGroup: Record<string, SshProfile[]> = {};
        for (const p of others) {
            const key = p.category?.trim() || '';
            if (!byGroup[key]) byGroup[key] = [];
            byGroup[key].push(p);
        }
        const named = Object.keys(byGroup).filter(k => k).sort();
        for (const name of named) groups.push({ label: name, items: byGroup[name] });
        if (byGroup['']) groups.push({ label: named.length > 0 ? 'Other' : '', items: byGroup[''] });
    }
    const sortedProfiles = filteredProfiles;

    const handleAdd = () => {
        setEditingProfile(null);
        setIsModalOpen(true);
    };

    const handleEdit = (profile: SshProfile, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProfile(profile);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const isConfirmed = await confirm({
            title: 'Delete Connection',
            message: 'Are you sure you want to delete this connection? This action is permanent.',
            confirmLabel: 'Delete',
            isDestructive: true
        });
        if (isConfirmed) {
            await deleteProfile(id);
        }
    };

    const handleToggleFavorite = async (profile: SshProfile, e: React.MouseEvent) => {
        e.stopPropagation();
        await saveProfile({ ...profile, is_favorite: !profile.is_favorite });
    };

    const handleContextMenu = (e: React.MouseEvent, profile?: SshProfile) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, profile });
    };

    const closeContextMenu = () => setContextMenu(null);

    /* ── Render helpers ───────────────────────────────────────── */

    const renderItem = (profile: SshProfile) => {
        const commonProps = {
            key: profile.id,
            profile,
            query: q,
            onConnect: () => onConnect && onConnect(profile),
            onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, profile),
        };

        if (viewMode === 'cards') {
            return (
                <ConnectionCard
                    {...commonProps}
                    onToggleFavorite={(e) => handleToggleFavorite(profile, e)}
                />
            );
        }
        return <CompactRow {...commonProps} />;
    };

    return (
        <div
            style={{ width: isCollapsed ? '52px' : `${width}px` }}
            className={`h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col justify-between transition-all duration-200 shrink-0 relative ${isResizing ? 'select-none pointer-events-none' : ''}`}
            onClick={closeContextMenu}
            onContextMenu={(e) => handleContextMenu(e)}
        >
            {/* Collapse Toggle */}
            <button
                onClick={toggleCollapse}
                className={`absolute -right-2 top-6 z-50 w-4 h-6 rounded-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] shadow-sm transition-colors ${isPanelOpen ? 'hidden' : ''}`}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? <ChevronRight size={11} strokeWidth={3} /> : <ChevronLeft size={11} strokeWidth={3} />}
            </button>

            {/* Main content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {isCollapsed ? (
                    /* ── Collapsed rail ──────────────────────────── */
                    <div className="flex flex-col items-center pt-4 gap-3 overflow-hidden">
                        <Logo size={24} />
                        <div className="w-full border-t border-[var(--border-color)]" />
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="relative text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-2 rounded-md transition-colors"
                            title="Settings"
                        >
                            <Settings size={16} />
                            {updateStatus === 'available' && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--bg-sidebar)]" />
                            )}
                        </button>
                        <button
                            onClick={handleAdd}
                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-2 rounded-md transition-colors"
                            title="New Connection"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-2 rounded-md transition-colors"
                            title="Import Connections"
                        >
                            <Upload size={16} />
                        </button>
                        <button
                            onClick={togglePanel}
                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-2 rounded-md transition-colors"
                            title="Network Sharing"
                        >
                            <Users size={16} />
                        </button>
                        {sortedProfiles.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => onConnect && onConnect(p)}
                                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--hover-color)] transition-colors"
                                title={`${p.name} (${p.host})`}
                            >
                                {p.is_favorite
                                    ? <Star size={16} style={p.color ? { color: p.color, fill: p.color } : {}} className="fill-amber-400 text-amber-400" />
                                    : <Shield size={16} style={p.color ? { color: p.color } : {}} className="text-[var(--accent-color)]" />
                                }
                            </button>
                        ))}
                    </div>
                ) : (
                    /* ── Expanded ────────────────────────────────── */
                    <div className="flex-1 overflow-hidden flex flex-col p-4">
                        <div className="flex items-center justify-between mb-4 shrink-0 gap-2">
                            <div className="flex items-center gap-2">
                                <Logo size={24} />
                                <h1 className="text-lg font-bold tracking-tight text-[var(--text-main)]">Cliqon</h1>
                            </div>
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="relative text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-1.5 rounded-md transition-colors"
                                title="Settings"
                            >
                                <Settings size={16} />
                                {updateStatus === 'available' && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--bg-sidebar)]" />
                                )}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                            <div>
                                {/* Header: Connections + actions */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                                            Connections
                                        </h2>
                                        {profiles.length > 0 && (
                                            <span className="group-count-badge">{profiles.length}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* View mode toggle */}
                                        <div className="view-toggle">
                                            <button
                                                className={viewMode === 'cards' ? 'active' : ''}
                                                onClick={() => switchViewMode('cards')}
                                                title="Card view"
                                            >
                                                <LayoutGrid size={12} />
                                            </button>
                                            <button
                                                className={viewMode === 'compact' ? 'active' : ''}
                                                onClick={() => switchViewMode('compact')}
                                                title="Compact view"
                                            >
                                                <List size={12} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setIsImportModalOpen(true)}
                                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-1 rounded-md transition-colors"
                                            title="Import connections"
                                        >
                                            <Upload size={13} />
                                        </button>
                                        <button
                                            onClick={togglePanel}
                                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-1 rounded-md transition-colors"
                                            title="Network sharing"
                                        >
                                            <Users size={13} />
                                        </button>
                                        <button
                                            onClick={handleAdd}
                                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-1 rounded-md transition-colors"
                                            title="New connection (Ctrl+N)"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                {profiles.length > 0 && (
                                    <div className="relative mb-3">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search… (Ctrl+F)"
                                            className="w-full pl-7 pr-6 py-1.5 text-[11px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Content */}
                                {isLoading ? (
                                    <div className="text-xs text-[var(--text-muted)] py-4 text-center">
                                        <div className="animate-pulse">Loading profiles...</div>
                                    </div>
                                ) : profiles.length === 0 ? (
                                    <div className="text-xs text-[var(--text-muted)] py-6 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                                        <TerminalSquare size={24} className="mx-auto mb-2 opacity-40" />
                                        No connections yet.<br />Click <strong>+</strong> to add one.
                                    </div>
                                ) : filteredProfiles.length === 0 ? (
                                    <div className="text-xs text-[var(--text-muted)] py-4 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                                        <Search size={20} className="mx-auto mb-2 opacity-40" />
                                        No results for &quot;{searchQuery}&quot;
                                    </div>
                                ) : groupedView ? (
                                    /* ── Grouped view ──────────────────────── */
                                    <div className="space-y-3">
                                        {groups.map(({ label, items }) => (
                                            <div key={label || '__ungrouped__'}>
                                                {label && (
                                                    <button
                                                        onClick={() => toggleGroup(label)}
                                                        className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors rounded hover:bg-[var(--hover-color)]"
                                                    >
                                                        {groups.find(g => g.label === label)?.isFavorite ? (
                                                            <Star size={10} className="shrink-0 fill-amber-400 text-amber-400" />
                                                        ) : (
                                                            <Folder size={10} className="shrink-0" />
                                                        )}
                                                        <span className="flex-1 text-left truncate">{label}</span>
                                                        <span className="group-count-badge">{items.length}</span>
                                                        <ChevronDown size={10} className={`transition-transform duration-200 ${collapsedGroups[label] ? '-rotate-90' : ''}`} />
                                                    </button>
                                                )}
                                                {!collapsedGroups[label] && (
                                                    <div className={`space-y-1.5 ${label ? 'mt-1' : ''}`}>
                                                        {items.map(renderItem)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* ── Flat search results ───────────────── */
                                    <div className="space-y-1.5">
                                        {filteredProfiles.map(renderItem)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Settings button moved to top of sidebar */}

            <ProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                existingProfile={editingProfile}
                existingGroups={existingGroups}
                onSave={saveProfile}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => { }}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            {/* Settings button moved to top of sidebar */}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[90]"
                        onClick={closeContextMenu}
                        onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
                    />
                    <div
                        className="fixed z-[100] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={e => e.stopPropagation()}
                    >
                        {contextMenu.profile ? (
                            <>
                                <button
                                    onClick={() => {
                                        onConnect?.(contextMenu.profile!);
                                        closeContextMenu();
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--hover-color)] flex items-center gap-2"
                                >
                                    <TerminalSquare size={12} /> Connect
                                </button>
                                <button
                                    onClick={(e) => {
                                        handleEdit(contextMenu.profile!, e);
                                        closeContextMenu();
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--hover-color)] flex items-center gap-2"
                                >
                                    <Edit2 size={12} /> Edit
                                </button>
                                <div className="border-t border-[var(--border-color)] my-1" />
                                <button
                                    onClick={(e) => {
                                        handleDelete(contextMenu.profile!.id, e);
                                        closeContextMenu();
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => {
                                    handleAdd();
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--hover-color)] flex items-center gap-2"
                            >
                                <Plus size={12} /> New Connection
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Resize Handle */}
            {!isCollapsed && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent-color)] z-30 transition-colors pointer-events-auto"
                    onMouseDown={startResizing}
                >
                    <div className={`w-full h-full ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
                </div>
            )}
        </div>
    );
};
