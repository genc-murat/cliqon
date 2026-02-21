import React, { useState, useRef, useEffect } from 'react';
import { Settings, Shield, TerminalSquare, Plus, MoreVertical, Edit2, Trash2, Star, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useConnections } from '../../hooks/useConnections';
import { ProfileModal } from '../ui/ProfileModal';
import { SettingsModal } from '../ui/SettingsModal';
import { SshProfile } from '../../types/connection';
import { useResizable } from '../../hooks/useResizable';
import { Logo } from './Logo';

interface SidebarProps {
    onConnect?: (profile: SshProfile) => void;
    /** Callback that lets the parent open the "Add connection" modal via keyboard shortcut */
    openAddModalRef?: React.MutableRefObject<(() => void) | null>;
    /** Callback that lets the parent focus the search box via keyboard shortcut */
    focusSearchRef?: React.MutableRefObject<(() => void) | null>;
}

export const Sidebar: React.FC<SidebarProps> = ({ onConnect, openAddModalRef, focusSearchRef }) => {
    const { profiles, isLoading, saveProfile, deleteProfile } = useConnections();
    const { width, startResizing, isResizing } = useResizable(256, 160, 600);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<SshProfile | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // Expose handleAdd and search focus to parent for keyboard shortcuts
    useEffect(() => {
        if (openAddModalRef) openAddModalRef.current = handleAdd;
        if (focusSearchRef) focusSearchRef.current = () => {
            if (isCollapsed) {
                // Expand sidebar first so the search box is visible
                setIsCollapsed(false);
                localStorage.setItem('sidebar-collapsed', 'false');
                setTimeout(() => searchRef.current?.focus(), 220);
            } else {
                searchRef.current?.focus();
            }
        };
    });

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('sidebar-collapsed', String(next));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };

    // Filter then sort: favorites first, then alphabetically
    const q = searchQuery.toLowerCase().trim();
    const sortedProfiles = [...profiles]
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

    const handleAdd = () => {
        setEditingProfile(null);
        setIsModalOpen(true);
    };

    const handleEdit = (profile: SshProfile, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProfile(profile);
        setIsModalOpen(true);
        setActiveMenuId(null);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this connection?')) {
            await deleteProfile(id);
        }
        setActiveMenuId(null);
    };

    return (
        <div
            style={{ width: isCollapsed ? '52px' : `${width}px` }}
            className={`h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col justify-between transition-all duration-200 shrink-0 relative ${isResizing ? 'select-none pointer-events-none' : ''}`}
        >
            {/* Collapse Toggle Button */}
            <button
                onClick={toggleCollapse}
                className="absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] shadow-sm transition-colors"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            {/* Main scrollable section */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {isCollapsed ? (
                    /* Collapsed: icon-only rail */
                    <div className="flex flex-col items-center pt-4 gap-3 overflow-hidden">
                        <Logo size={24} />
                        <div className="w-full border-t border-[var(--border-color)]" />
                        <button
                            onClick={handleAdd}
                            className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-2 rounded-md transition-colors"
                            title="New Connection"
                        >
                            <Plus size={16} />
                        </button>
                        {sortedProfiles.map((p) => (
                            <button
                                key={p.id}
                                onDoubleClick={() => onConnect && onConnect(p)}
                                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--hover-color)] transition-colors"
                                title={p.name}
                            >
                                {p.is_favorite
                                    ? <Star size={16} style={p.color ? { color: p.color, fill: p.color } : {}} className="fill-[var(--accent-color)] text-[var(--accent-color)]" />
                                    : <Shield size={16} style={p.color ? { color: p.color } : {}} className="text-[var(--accent-color)]" />
                                }
                            </button>
                        ))}
                    </div>
                ) : (
                    /* Expanded */
                    <div className="flex-1 overflow-hidden flex flex-col p-4">
                        <div className="flex items-center gap-2 mb-8 shrink-0">
                            <Logo size={32} />
                            <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Cliqon</h1>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Connections</h2>
                                    <button
                                        onClick={handleAdd}
                                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] p-1 rounded-md transition-colors"
                                        title="New connection (Ctrl+N)"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                {/* Search / filter */}
                                {profiles.length > 0 && (
                                    <div className="relative mb-2">
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search… (Ctrl+F)"
                                            className="w-full pl-7 pr-6 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                            >
                                                <X size={11} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {isLoading ? (
                                    <div className="text-xs text-[var(--text-muted)] py-2 text-center">Loading profiles...</div>
                                ) : profiles.length === 0 ? (
                                    <div className="text-xs text-[var(--text-muted)] py-4 text-center border border-dashed border-[var(--border-color)] rounded-md">
                                        No connections.<br />Click + to add one.
                                    </div>
                                ) : sortedProfiles.length === 0 ? (
                                    <div className="text-xs text-[var(--text-muted)] py-4 text-center border border-dashed border-[var(--border-color)] rounded-md">
                                        No results for &quot;{searchQuery}&quot;
                                    </div>
                                ) : (
                                    <ul className="space-y-1">
                                        {sortedProfiles.map((profile) => (
                                            <li
                                                key={profile.id}
                                                onDoubleClick={() => onConnect && onConnect(profile)}
                                                className="group relative flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-[var(--hover-color)] cursor-pointer text-sm text-[var(--text-main)] transition-colors"
                                                style={profile.color ? {
                                                    borderLeft: `3px solid ${profile.color}`,
                                                    paddingLeft: '10px',
                                                    backgroundColor: `${profile.color}18`
                                                } : {}}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {profile.is_favorite
                                                        ? <Star size={16} className="shrink-0 fill-[var(--accent-color)] text-[var(--accent-color)]" />
                                                        : <Shield size={16} className="text-[var(--accent-color)] shrink-0" />
                                                    }
                                                    <span className="truncate">{profile.name}</span>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === profile.id ? null : profile.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-md transition-all"
                                                >
                                                    <MoreVertical size={14} />
                                                </button>

                                                {activeMenuId === profile.id && (
                                                    <div className="absolute right-2 top-8 z-20 w-32 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md shadow-lg py-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); onConnect && onConnect(profile); }}
                                                            className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--hover-color)] flex items-center gap-2"
                                                        >
                                                            <TerminalSquare size={12} /> Connect
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleEdit(profile, e)}
                                                            className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--hover-color)] flex items-center gap-2"
                                                        >
                                                            <Edit2 size={12} /> Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(profile.id, e)}
                                                            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                                        >
                                                            <Trash2 size={12} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Settings button — Always visible, adapts to collapsed state */}
            <div className={`border-t border-[var(--border-color)] shrink-0 ${isCollapsed ? 'p-2' : 'px-4 pt-4 pb-4 space-y-3'}`}>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-md transition-colors font-medium"
                    style={{ width: '100%', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
                    title="Settings"
                >
                    <Settings size={18} />
                    {!isCollapsed && 'Settings'}
                </button>
            </div>

            <ProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                existingProfile={editingProfile}
                onSave={saveProfile}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            {/* Click outside context menu handler */}
            {activeMenuId && (
                <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
            )}

            {/* Resize Handle (only when expanded) */}
            {!isCollapsed && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent-color)] z-50 transition-colors pointer-events-auto"
                    onMouseDown={startResizing}
                >
                    <div className={`w-full h-full ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
                </div>
            )}
        </div>
    );
};
