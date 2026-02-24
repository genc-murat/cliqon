import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Folder, Download, RefreshCw, ChevronLeft, ChevronRight, Edit2, Trash2, Copy, FileText, Network, ShieldAlert, Activity, ArrowUpCircle, Star, Bookmark, X as XIcon, File as FileIcon, TerminalSquare, Settings, Eye, EyeOff, Archive, Check, SortAsc, FilePlus, Clipboard, Scissors } from 'lucide-react';
import { SshProfile, FileNode } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';
import { TransferQueue } from './TransferQueue';
import { FilePropertiesModal } from './FilePropertiesModal';
import { TextEditorModal } from './TextEditorModal';
import { DockerComposeVisualizer } from './DockerComposeVisualizer';
import { LogViewerModal } from './LogViewerModal';
import { useSftpBookmarks } from '../../hooks/useSftpBookmarks';
import { useConfirm } from '../../hooks/useConfirm';

interface FileBrowserProps {
    profile: SshProfile;
    sessionId: string;
    isActive: boolean;
}

interface ContextMenu {
    x: number;
    y: number;
    file: FileNode;
}

type SortBy = 'name' | 'size' | 'date';
type SortDir = 'asc' | 'desc';

interface ClipboardState {
    files: FileNode[];
    action: 'copy' | 'cut';
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ profile, sessionId, isActive }) => {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string>('.');
    const [files, setFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('cliqon-sftp-collapsed') === 'true');
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [renamingFile, setRenamingFile] = useState<FileNode | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [propsModal, setPropsModal] = useState<string | null>(null); // path
    const [editingFile, setEditingFile] = useState<FileNode | null>(null);
    const [isSudoEdit, setIsSudoEdit] = useState<boolean>(false);
    const [visualizeComposeFile, setVisualizeComposeFile] = useState<FileNode | null>(null);
    const [tailingFile, setTailingFile] = useState<FileNode | null>(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [bookmarksOpen, setBookmarksOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isWatching, setIsWatching] = useState(false);
    const [showHiddenFiles, setShowHiddenFiles] = useState(() => localStorage.getItem('cliqon-sftp-show-hidden') === 'true');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [createModal, setCreateModal] = useState<{
        isOpen: boolean;
        type: 'file' | 'folder';
        onSubmit: (name: string) => void;
        onCancel: () => void;
    } | null>(null);
    const [promptModal, setPromptModal] = useState<{
        isOpen: boolean;
        title: string;
        defaultValue: string;
        onSubmit: (val: string) => void;
        onCancel: () => void;
    } | null>(null);

    const renameInputRef = useRef<HTMLInputElement>(null);
    const confirm = useConfirm();
    const { width, startResizing, isResizing } = useResizable(256, 160, 600);
    const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useSftpBookmarks(profile.host);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('cliqon-sftp-collapsed', String(next));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };

    const toggleHiddenFiles = () => {
        const next = !showHiddenFiles;
        setShowHiddenFiles(next);
        localStorage.setItem('cliqon-sftp-show-hidden', String(next));
    };

    const toggleSortBy = (newSortBy: SortBy) => {
        if (sortBy === newSortBy) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortDir('asc');
        }
    };

    // Ctrl+B global shortcut → toggle this SFTP panel (only for active tab)
    useEffect(() => {
        if (!isActive) return;
        const handler = () => toggleCollapse();
        window.addEventListener('cliqon:toggle-sftp', handler);
        return () => window.removeEventListener('cliqon:toggle-sftp', handler);
    }, [isActive]);

    const showStatus = (msg: string) => {
        setStatusMsg(msg);
        setTimeout(() => setStatusMsg(''), 3000);
    };

    const fetchDirectory = useCallback(async (path: string) => {
        setIsLoading(true);
        try {
            await api.listSftpDir(sessionId, path);
        } catch (err: any) {
            setError(err.toString());
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        let isMounted = true;
        let unlistenRx: UnlistenFn | null = null;
        let unlistenTransferDone: UnlistenFn | null = null;
        let unlistenRenameDone: UnlistenFn | null = null;
        let unlistenDeleteDone: UnlistenFn | null = null;
        let unlistenDeleteErr: UnlistenFn | null = null;
        let unlistenRenameErr: UnlistenFn | null = null;
        let unlistenWatch: UnlistenFn | null = null;
        let unlistenCreateDirDone: UnlistenFn | null = null;
        let unlistenCreateDirErr: UnlistenFn | null = null;
        let unlistenCreateFileDone: UnlistenFn | null = null;
        let unlistenCreateFileErr: UnlistenFn | null = null;
        let unlistenCopyDone: UnlistenFn | null = null;
        let unlistenCopyErr: UnlistenFn | null = null;
        let unlistenMoveDone: UnlistenFn | null = null;
        let unlistenMoveErr: UnlistenFn | null = null;

        const setupSftp = async () => {
            try {
                unlistenRx = await listen<FileNode[]>(`sftp_dir_rx_${sessionId}`, (event) => {
                    if (isMounted) { setFiles(event.payload); setIsLoading(false); setSelectedIndex(-1); }
                });
                unlistenTransferDone = await listen<string>(`sftp_transfer_done_${sessionId}`, () => {
                    if (isMounted) fetchDirectory(currentPath);
                });
                unlistenRenameDone = await listen<string>(`sftp_rename_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ Renamed'); }
                });
                unlistenRenameErr = await listen<string>(`sftp_rename_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Rename failed: ${e.payload} `);
                });
                unlistenDeleteDone = await listen<string>(`sftp_delete_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ Deleted'); }
                });
                unlistenDeleteErr = await listen<string>(`sftp_delete_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Delete failed: ${e.payload} `);
                });

                unlistenWatch = await listen<string>(`sftp_watch_changed_${sessionId}`, (e) => {
                    if (isMounted && e.payload === currentPath) fetchDirectory(currentPath);
                });

                unlistenCreateDirDone = await listen<string>(`sftp_createdir_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ Folder created'); }
                });
                unlistenCreateDirErr = await listen<string>(`sftp_createdir_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Create folder failed: ${e.payload} `);
                });

                unlistenCreateFileDone = await listen<string>(`sftp_createfile_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ File created'); }
                });
                unlistenCreateFileErr = await listen<string>(`sftp_createfile_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Create file failed: ${e.payload} `);
                });

                unlistenCopyDone = await listen<{ source: string; dest: string }>(`sftp_copy_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ Copied'); }
                });
                unlistenCopyErr = await listen<string>(`sftp_copy_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Copy failed: ${e.payload} `);
                });

                unlistenMoveDone = await listen<{ source: string; dest: string }>(`sftp_move_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); setClipboard(null); showStatus('✅ Moved'); }
                });
                unlistenMoveErr = await listen<string>(`sftp_move_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Move failed: ${e.payload} `);
                });

                await api.connectSftp(profile, sessionId);
                if (isMounted) { setConnected(true); fetchDirectory(currentPath); }
            } catch (err: any) {
                if (isMounted) setError(`SFTP Error: ${err} `);
            }
        };

        setupSftp();

        return () => {
            isMounted = false;
            [unlistenRx, unlistenTransferDone, unlistenRenameDone, unlistenRenameErr,
                unlistenDeleteDone, unlistenDeleteErr, unlistenWatch, unlistenCreateDirDone,
                unlistenCreateDirErr, unlistenCreateFileDone, unlistenCreateFileErr,
                unlistenCopyDone, unlistenCopyErr, unlistenMoveDone, unlistenMoveErr].forEach(u => u?.());
            api.closeSftp(sessionId).catch((err) => {
                console.error('Failed to close SFTP:', err);
            });
        };
    }, [profile, sessionId, currentPath, fetchDirectory]);

    const handleNavigate = (node: FileNode) => {
        if (node.is_dir) {
            setSelectedFiles(new Set());
            setCurrentPath(node.path);
            fetchDirectory(node.path);
        }
    };

    const handleUpDirectory = () => {
        if (currentPath === '.' || currentPath === '/') return;
        const normalizedPath = currentPath.startsWith('/') ? currentPath : '/' + currentPath;
        const parts = normalizedPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
        setSelectedFiles(new Set());
        setCurrentPath(newPath);
        fetchDirectory(newPath);
    };

    const toggleSelection = (e: React.MouseEvent, file: FileNode) => {
        e.stopPropagation();
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(file.path)) next.delete(file.path);
            else next.add(file.path);
            return next;
        });
    };

    const filteredFiles = useMemo(() => {
        let result = showHiddenFiles
            ? files
            : files.filter(f => !f.name.startsWith('.'));
        
        result.sort((a, b) => {
            if (sortBy === 'name') {
                const cmp = a.name.localeCompare(b.name);
                return sortDir === 'asc' ? cmp : -cmp;
            } else if (sortBy === 'size') {
                const cmp = a.size - b.size;
                return sortDir === 'asc' ? cmp : -cmp;
            } else if (sortBy === 'date') {
                const cmp = a.modified_at - b.modified_at;
                return sortDir === 'asc' ? cmp : -cmp;
            }
            return a.name.localeCompare(b.name);
        });

        return result;
    }, [files, showHiddenFiles, sortBy, sortDir]);

    useEffect(() => {
        if (!connected) return;
        if (isWatching) {
            api.startSftpWatch(sessionId, currentPath).catch(console.error);
        } else {
            api.stopSftpWatch(sessionId).catch(console.error);
        }
    }, [isWatching, currentPath, connected, sessionId]);


    // Drag-and-drop upload
    useEffect(() => {
        if (!isActive || !connected) return;
        let unlistenDrop: UnlistenFn | null = null;

        const setupDrop = async () => {
            unlistenDrop = await listen<{ paths: string[] }>('tauri://drop', (event) => {
                if (!isActive || !connected) return;
                for (const localPath of event.payload.paths) {
                    const filename = localPath.split(/[/\\]/).pop();
                    if (filename) {
                        const remotePath = `${currentPath === '/' ? '' : currentPath}/${filename}`;
                        api.uploadSftp(sessionId, localPath, remotePath).catch(console.error);
                    }
                }
            });
        };

        setupDrop();
        return () => { unlistenDrop?.(); };
    }, [isActive, connected, currentPath, sessionId]);

    const handleContextMenu = (e: React.MouseEvent, file: FileNode) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, file });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Context menu actions
    const handleDownload = async (file: FileNode) => {
        closeContextMenu();
        setPromptModal({
            isOpen: true,
            title: `Save "${file.name}" to local path:`,
            defaultValue: file.name,
            onSubmit: async (savePath) => {
                if (savePath && savePath.trim()) {
                    await api.downloadSftp(sessionId, file.path, savePath.trim());
                    showStatus(`⬇️ Downloading ${file.name}...`);
                }
                setPromptModal(null);
            },
            onCancel: () => setPromptModal(null)
        });
    };

    const handleDelete = async (file: FileNode) => {
        closeContextMenu();
        const isConfirmed = await confirm({
            title: 'Delete File',
            message: `Are you sure you want to delete "${file.name}"? This action cannot be undone.`,
            confirmLabel: 'Delete',
            isDestructive: true
        });
        if (!isConfirmed) return;
        await api.deleteSftp(sessionId, file.path, file.is_dir);
    };

    const handleCopy = (file: FileNode) => {
        closeContextMenu();
        setClipboard({ files: [file], action: 'copy' });
        showStatus('📋 Copied to clipboard');
    };

    const handleCut = (file: FileNode) => {
        closeContextMenu();
        setClipboard({ files: [file], action: 'cut' });
        showStatus('✂️ Cut to clipboard');
    };

    const handleCopySelected = () => {
        if (selectedFiles.size === 0) return;
        const selectedNodes = files.filter(f => selectedFiles.has(f.path));
        setClipboard({ files: selectedNodes, action: 'copy' });
        showStatus(`📋 ${selectedNodes.length} files copied`);
    };

    const handleCutSelected = () => {
        if (selectedFiles.size === 0) return;
        const selectedNodes = files.filter(f => selectedFiles.has(f.path));
        setClipboard({ files: selectedNodes, action: 'cut' });
        showStatus(`✂️ ${selectedNodes.length} files cut`);
    };

    const handlePaste = (destPath?: string) => {
        if (!clipboard) return;
        const targetPath = destPath || currentPath;
        closeContextMenu();
        
        if (clipboard.action === 'copy') {
            clipboard.files.forEach(async (file) => {
                const fileName = file.name;
                const dest = `${targetPath === '/' ? '' : targetPath}/${fileName}`;
                await api.copySftpFile(sessionId, file.path, dest);
            });
        } else {
            clipboard.files.forEach(async (file) => {
                const fileName = file.name;
                const dest = `${targetPath === '/' ? '' : targetPath}/${fileName}`;
                await api.moveSftpFile(sessionId, file.path, dest);
            });
        }
    };

    const handleCreateFile = () => {
        setCreateModal({
            isOpen: true,
            type: 'file',
            onSubmit: async (name) => {
                if (!name.trim()) return;
                const newPath = `${currentPath === '/' ? '' : currentPath}/${name.trim()}`;
                await api.createSftpFile(sessionId, newPath, '');
                setCreateModal(null);
            },
            onCancel: () => setCreateModal(null)
        });
    };

    const handleCreateFolder = () => {
        setCreateModal({
            isOpen: true,
            type: 'folder',
            onSubmit: async (name) => {
                if (!name.trim()) return;
                const newPath = `${currentPath === '/' ? '' : currentPath}/${name.trim()}`;
                await api.createSftpDir(sessionId, newPath);
                setCreateModal(null);
            },
            onCancel: () => setCreateModal(null)
        });
    };

    const handleSelectAll = () => {
        setSelectedFiles(new Set(filteredFiles.map(f => f.path)));
    };

    useEffect(() => {
        if (!isActive || !connected || isCollapsed) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (renamingFile) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                handleNavigate(filteredFiles[selectedIndex]);
            } else if (e.key === 'F2' && selectedIndex >= 0) {
                e.preventDefault();
                handleStartRename(filteredFiles[selectedIndex]);
            } else if (e.key === 'Delete' && selectedIndex >= 0) {
                e.preventDefault();
                handleDelete(filteredFiles[selectedIndex]);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                handleSelectAll();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedFiles.size > 0) {
                    handleCopySelected();
                } else if (selectedIndex >= 0) {
                    handleCopy(filteredFiles[selectedIndex]);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                if (selectedFiles.size > 0) {
                    handleCutSelected();
                } else if (selectedIndex >= 0) {
                    handleCut(filteredFiles[selectedIndex]);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                if (clipboard) handlePaste();
            } else if (e.key === 'Escape') {
                setSelectedFiles(new Set());
                setSelectedIndex(-1);
                closeContextMenu();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, connected, isCollapsed, renamingFile, selectedIndex, filteredFiles, selectedFiles, clipboard]);

    const handleStartRename = (file: FileNode) => {
        closeContextMenu();
        setRenamingFile(file);
        setRenameValue(file.name);
        setTimeout(() => renameInputRef.current?.select(), 50);
    };

    const handleRenameSubmit = async () => {
        if (!renamingFile || !renameValue.trim() || renameValue === renamingFile.name) {
            setRenamingFile(null);
            return;
        }
        const dir = renamingFile.path.substring(0, renamingFile.path.lastIndexOf('/') + 1);
        const newPath = dir + renameValue.trim();
        setRenamingFile(null);
        try {
            await api.renameSftp(sessionId, renamingFile.path, newPath);
        } catch (err: any) {
            showStatus(`❌ Rename failed: ${err}`);
        }
    };

    const handleCopyPath = (file: FileNode) => {
        closeContextMenu();
        navigator.clipboard.writeText(file.path).then(() => showStatus('📋 Path copied to clipboard'));
    };

    const handleCopyToTerminal = async (file: FileNode) => {
        closeContextMenu();
        const cmd = `cd "${file.path}"\n`;
        const bytes = Array.from(new TextEncoder().encode(cmd));
        await api.writeToPty(sessionId, bytes);
        showStatus('📤 Path sent to terminal');
    };

    const handleProperties = (file: FileNode) => {
        closeContextMenu();
        setPropsModal(file.path);
    };

    const handleOpenEditor = (file: FileNode, sudo: boolean = false) => {
        setEditingFile(file);
        setIsSudoEdit(sudo);
        closeContextMenu();
    };

    const handleVisualizeCompose = (file: FileNode) => {
        closeContextMenu();
        setVisualizeComposeFile(file);
    };

    const handleTailLog = (file: FileNode) => {
        closeContextMenu();
        setTailingFile(file);
    };

    const formatSize = (bytes: number) => {
        if (bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <>
            <div
                style={{ width: isCollapsed ? '36px' : `${width}px` }}
                className={`h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0 relative transition-all duration-200 ${isResizing ? 'select-none pointer-events-none' : ''}`}
                onClick={closeContextMenu}
            >
                {/* Collapse Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
                    className="absolute -right-2 top-3 z-30 w-4 h-6 rounded-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-sm transition-colors"
                    title={isCollapsed ? 'Expand SFTP browser' : 'Collapse SFTP browser'}
                >
                    {isCollapsed ? <ChevronRight size={11} strokeWidth={3} /> : <ChevronLeft size={11} strokeWidth={3} />}
                </button>

                {isCollapsed ? (
                    <div className="flex flex-col items-center pt-3">
                        <Folder size={18} className="text-[var(--accent-color)]" />
                    </div>
                ) : (
                    <>
                        {/* Header - Row 1: Navigation + Main actions */}
                        <div className="p-2 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]">
                            <div className="flex items-center gap-1 overflow-hidden">
                                <button
                                    onClick={handleUpDirectory}
                                    disabled={currentPath === '.' || currentPath === '/'}
                                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded disabled:opacity-50"
                                    title="Go up"
                                >
                                    <ArrowUpCircle size={16} />
                                </button>
                                <span className="text-xs font-mono text-[var(--text-muted)] truncate" title={currentPath}>
                                    {currentPath}
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button onClick={() => fetchDirectory(currentPath)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded" title="Refresh">
                                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={handleCreateFile} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded" title="New file">
                                    <FilePlus size={14} />
                                </button>
                                <button onClick={handleCreateFolder} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded" title="New folder">
                                    <Folder size={14} />
                                </button>
                                <button onClick={() => isBookmarked(currentPath) ? removeBookmark(currentPath) : addBookmark(currentPath)} className={`p-1 rounded ${isBookmarked(currentPath) ? 'text-amber-400' : 'text-[var(--text-muted)] hover:text-amber-400'}`} title={isBookmarked(currentPath) ? 'Remove bookmark' : 'Add bookmark'}>
                                    <Star size={14} fill={isBookmarked(currentPath) ? 'currentColor' : 'none'} />
                                </button>
                                <button onClick={() => setBookmarksOpen(p => !p)} className={`p-1 rounded ${bookmarksOpen ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} title="Bookmarks">
                                    <Bookmark size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Header - Row 2: View options */}
                        <div className="px-2 py-1.5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]">
                            <div className="flex items-center gap-0.5">
                                <button onClick={toggleHiddenFiles} className={`p-1 rounded ${showHiddenFiles ? 'text-amber-400' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} title={showHiddenFiles ? 'Hide hidden' : 'Show hidden'}>
                                    {showHiddenFiles ? <Eye size={13} /> : <EyeOff size={13} />}
                                </button>
                                <div className="w-px h-4 bg-[var(--border-color)] mx-0.5"></div>
                                <button onClick={() => toggleSortBy('name')} className={`p-1 rounded ${sortBy === 'name' ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} title="Sort by name">
                                    <SortAsc size={13} />
                                </button>
                                <button onClick={() => toggleSortBy('size')} className={`p-1 rounded ${sortBy === 'size' ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} title="Sort by size">
                                    <span className="text-[10px] font-bold">Sz</span>
                                </button>
                                <button onClick={() => toggleSortBy('date')} className={`p-1 rounded ${sortBy === 'date' ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} title="Sort by date">
                                    <span className="text-[10px] font-bold">Dt</span>
                                </button>
                            </div>
                            <div className="flex items-center gap-0.5">
                                {clipboard && (
                                    <button onClick={() => handlePaste()} className="p-1 text-green-400 hover:text-green-300 rounded" title="Paste">
                                        <Clipboard size={13} />
                                    </button>
                                )}
                                <button onClick={() => setIsWatching(!isWatching)} className={`p-1 rounded ${isWatching ? 'text-green-400' : 'text-[var(--text-muted)]'}`} title={isWatching ? 'Stop watching' : 'Watch directory'}>
                                    <Activity size={13} className={isWatching ? '' : 'opacity-50'} />
                                </button>
                            </div>
                        </div>

                        {/* Bookmarks panel */}
                        {bookmarksOpen && bookmarks.length > 0 && (
                            <div className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-2 py-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                                <div className="text-[9px] uppercase font-semibold tracking-wider text-[var(--text-muted)] px-1 pb-1">Bookmarks</div>
                                {bookmarks.map((bm) => (
                                    <div key={bm.path} className="flex items-center gap-1 group/bm">
                                        <button onClick={() => { fetchDirectory(bm.path); setCurrentPath(bm.path); }} className="flex-1 text-left flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-[var(--text-main)] hover:bg-[var(--hover-color)] truncate" title={bm.path}>
                                            <Bookmark size={11} className="text-amber-400 shrink-0" fill="currentColor" />
                                            <span className="truncate font-mono">{bm.path}</span>
                                        </button>
                                        <button onClick={() => removeBookmark(bm.path)} className="opacity-0 group-hover/bm:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 rounded transition-all" title="Remove">
                                            <XIcon size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Status bar */}
                        {statusMsg && (
                            <div className="px-3 py-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                {statusMsg}
                            </div>
                        )}

                        {/* Selection Toolbar */}
                        {selectedFiles.size > 0 && (
                            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--hover-color)] border-b border-[var(--border-color)]">
                                <span className="text-xs text-[var(--accent-color)]">{selectedFiles.size} selected</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            const defaultName = currentPath === '/' ? 'archive.zip' : `${currentPath.split('/').pop() || 'archive'}.zip`;
                                            setPromptModal({
                                                isOpen: true,
                                                title: 'Save ZIP as:',
                                                defaultValue: defaultName,
                                                onSubmit: async (savePath) => {
                                                    if (savePath && savePath.trim()) {
                                                        await api.downloadMultiZipSftp(sessionId, Array.from(selectedFiles), savePath.trim());
                                                        setSelectedFiles(new Set());
                                                    }
                                                    setPromptModal(null);
                                                },
                                                onCancel: () => setPromptModal(null)
                                            });
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                    >
                                        <Archive size={12} /> ZIP
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const isConfirmed = await confirm({
                                                title: 'Delete Multiple Files',
                                                message: `Are you sure you want to delete ${selectedFiles.size} files? This action cannot be undone.`,
                                                confirmLabel: 'Delete All',
                                                isDestructive: true
                                            });
                                            if (isConfirmed) {
                                                const paths = Array.from(selectedFiles);
                                                let successCount = 0;
                                                let failCount = 0;
                                                for (let i = 0; i < paths.length; i++) {
                                                    const path = paths[i];
                                                    const isDir = files.find(f => f.path === path)?.is_dir || false;
                                                    try {
                                                        await api.deleteSftp(sessionId, path, isDir);
                                                        successCount++;
                                                    } catch {
                                                        failCount++;
                                                    }
                                                }
                                                setSelectedFiles(new Set());
                                                if (failCount > 0) {
                                                    showStatus(`⚠️ Deleted ${successCount}, failed ${failCount}`);
                                                } else {
                                                    showStatus(`✅ Deleted ${successCount} files`);
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                    <button
                                        onClick={() => setSelectedFiles(new Set())}
                                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                    >
                                        <XIcon size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* File list */}
                        <div className="flex-1 overflow-y-auto w-full p-2 space-y-0.5">
                            {!connected ? (
                                <div className="text-xs text-[var(--text-muted)] text-center mt-10">
                                    {error ? <span className="text-red-400">{error}</span> : 'Connecting SFTP...'}
                                </div>
                            ) : files.length === 0 && !isLoading ? (
                                <div className="text-xs text-[var(--text-muted)] text-center mt-4">Empty folder</div>
                            ) : (
                                filteredFiles.map((file, idx) => (
                                    <div
                                        key={file.path}
                                        onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey || e.shiftKey) toggleSelection(e, file);
                                        }}
                                        onDoubleClick={() => handleNavigate(file)}
                                        onContextMenu={(e) => handleContextMenu(e, file)}
                                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer group select-none ${selectedFiles.has(file.path) ? 'bg-[var(--hover-color)]/80 ring-1 ring-[var(--accent-color)]/30' : selectedIndex === idx ? 'bg-[var(--hover-color)]' : 'hover:bg-[var(--hover-color)]'}`}
                                    >
                                        <div
                                            onClick={(e) => toggleSelection(e, file)}
                                            className={`w-3 h-3 border rounded-sm flex items-center justify-center shrink-0 transition-colors ${selectedFiles.has(file.path) ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white' : 'border-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:border-[var(--text-main)]'}`}
                                        >
                                            {selectedFiles.has(file.path) && <Check size={10} strokeWidth={3} />}
                                        </div>
                                        <div className="shrink-0 text-[var(--accent-color)]">
                                            {file.is_dir
                                                ? <Folder size={14} fill="currentColor" fillOpacity={0.2} />
                                                : <FileIcon size={14} className="text-[var(--text-muted)]" />
                                            }
                                        </div>

                                        {renamingFile?.path === file.path ? (
                                            <input
                                                ref={renameInputRef}
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onBlur={handleRenameSubmit}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameSubmit();
                                                    if (e.key === 'Escape') setRenamingFile(null);
                                                    e.stopPropagation();
                                                }}
                                                className="flex-1 text-xs bg-[var(--bg-primary)] border border-[var(--accent-color)] rounded px-1 py-0.5 text-[var(--text-main)] focus:outline-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <>
                                                <div className="flex-1 truncate text-xs text-[var(--text-main)] group-hover:text-[var(--accent-color)] transition-colors">
                                                    {file.name}
                                                </div>
                                                {!file.is_dir && (
                                                    <div className="text-[10px] text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {formatSize(file.size)}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="h-8 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                            Drag files here to upload • Right-click for options
                        </div>

                        {/* Resize Handle */}
                        <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent-color)] z-50 transition-colors pointer-events-auto"
                            onMouseDown={startResizing}
                        >
                            <div className={`w-full h-full ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
                        </div>

                        <TransferQueue sessionId={sessionId} />
                    </>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[90]" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
                    <div
                        className="fixed z-[100] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[180px] text-sm"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={e => e.stopPropagation()}
                    >
                        {contextMenu.file.is_dir && (
                            <button
                                onClick={() => { handleNavigate(contextMenu.file); closeContextMenu(); }}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                            >
                                <Folder size={14} className="text-[var(--accent-color)]" /> Open
                            </button>
                        )}
                        {!contextMenu.file.is_dir && (
                            <button
                                onClick={() => handleDownload(contextMenu.file)}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--accent-color)] hover:bg-[var(--hover-color)]"
                            >
                                <Download size={14} className="text-[var(--accent-color)]" /> Download
                            </button>
                        )}
                        {!contextMenu.file.is_dir && (
                            <>
                                <button
                                    onClick={() => handleOpenEditor(contextMenu.file, false)}
                                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                                >
                                    <FileText size={14} className="text-[var(--accent-color)]" /> Edit file
                                </button>
                                <button
                                    onClick={() => handleOpenEditor(contextMenu.file, true)}
                                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                                >
                                    <ShieldAlert size={14} className="text-red-400" /> Sudo Edit
                                </button>
                                {(contextMenu.file.name.endsWith('.log') || contextMenu.file.name.endsWith('.err') || contextMenu.file.name.endsWith('.out')) && (
                                    <button
                                        onClick={() => handleTailLog(contextMenu.file)}
                                        className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                                    >
                                        <Activity size={14} className="text-green-400" /> Tail Log
                                    </button>
                                )}
                            </>
                        )}
                        {!contextMenu.file.is_dir && (contextMenu.file.name === 'docker-compose.yml' || contextMenu.file.name === 'docker-compose.yaml' || contextMenu.file.name === 'compose.yml' || contextMenu.file.name === 'compose.yaml') && (
                            <button
                                onClick={() => handleVisualizeCompose(contextMenu.file)}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                            >
                                <Network size={14} className="text-[var(--accent-color)]" /> Visualize Compose
                            </button>
                        )}
                        <button
                            onClick={() => handleStartRename(contextMenu.file)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                        >
                            <Edit2 size={14} /> Rename
                        </button>
                        <button
                            onClick={() => handleCopyPath(contextMenu.file)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                        >
                            <Copy size={14} /> Copy Path
                        </button>
                        <button
                            onClick={() => handleCopy(contextMenu.file)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                        >
                            <Clipboard size={14} /> Copy
                        </button>
                        <button
                            onClick={() => handleCut(contextMenu.file)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                        >
                            <Scissors size={14} /> Cut
                        </button>
                        {contextMenu.file.is_dir && (
                            <button
                                onClick={() => handleCopyToTerminal(contextMenu.file)}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                            >
                                <TerminalSquare size={14} /> cd to Terminal
                            </button>
                        )}
                        <div className="border-t border-[var(--border-color)] my-1" />
                        <button
                            onClick={() => handleProperties(contextMenu.file)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                        >
                            <Settings size={14} /> Properties
                        </button>
                        <div className="border-t border-[var(--border-color)] my-1" />
                        <button
                            onClick={() => handleDelete(contextMenu.file)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                </>
            )}

            {/* Properties Modal */}
            <FilePropertiesModal
                isOpen={!!propsModal}
                onClose={() => setPropsModal(null)}
                filePath={propsModal ?? ''}
                sessionId={sessionId}
                onChmodDone={() => fetchDirectory(currentPath)}
            />

            {/* Text Editor Modal */}
            {editingFile && (
                <TextEditorModal
                    sessionId={sessionId}
                    profile={profile}
                    filePath={editingFile.path}
                    fileName={editingFile.name}
                    isSudo={isSudoEdit}
                    onClose={() => setEditingFile(null)}
                />
            )}

            {tailingFile && (
                <LogViewerModal
                    sessionId={sessionId}
                    profile={profile}
                    filePath={tailingFile.path}
                    fileName={tailingFile.name}
                    onClose={() => setTailingFile(null)}
                />
            )}

            {/* Compose Visualizer Modal */}
            {visualizeComposeFile && (
                <DockerComposeVisualizer
                    profile={profile}
                    initialPath={visualizeComposeFile.path}
                    onClose={() => setVisualizeComposeFile(null)}
                />
            )}

            {/* Create Modal */}
            {createModal && createModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={createModal.onCancel}>
                    <div
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded shadow-xl w-80 p-4 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-sm font-medium text-[var(--text-main)] mb-3">
                            {createModal.type === 'folder' ? 'Create New Folder' : 'Create New File'}
                        </div>
                        <input
                            type="text"
                            autoFocus
                            placeholder={createModal.type === 'folder' ? 'Folder name' : 'File name'}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val) createModal.onSubmit(val);
                                }
                                if (e.key === 'Escape') createModal.onCancel();
                            }}
                            className="w-full text-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] focus:border-[var(--accent-color)] rounded px-2 py-1.5 text-[var(--text-main)] mb-4 outline-none transition-colors"
                        />
                        <div className="flex justify-end gap-2 text-xs">
                            <button
                                onClick={createModal.onCancel}
                                className="px-3 py-1.5 rounded bg-[var(--hover-color)] text-[var(--text-main)] hover:bg-[var(--border-color)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={(e) => {
                                    const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                                    const val = input.value.trim();
                                    if (val) createModal.onSubmit(val);
                                }}
                                className="px-3 py-1.5 rounded bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Modal */}
            {promptModal && promptModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={promptModal.onCancel}>
                    <div
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded shadow-xl w-96 p-4 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-sm font-medium text-[var(--text-main)] mb-3">{promptModal.title}</div>
                        <input
                            type="text"
                            autoFocus
                            defaultValue={promptModal.defaultValue}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val) promptModal.onSubmit(val);
                                }
                                if (e.key === 'Escape') promptModal.onCancel();
                            }}
                            className="w-full text-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] focus:border-[var(--accent-color)] rounded px-2 py-1.5 text-[var(--text-main)] mb-4 outline-none transition-colors"
                        />
                        <div className="flex justify-end gap-2 text-xs">
                            <button
                                onClick={promptModal.onCancel}
                                className="px-3 py-1.5 rounded bg-[var(--hover-color)] text-[var(--text-main)] hover:bg-[var(--border-color)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={(e) => {
                                    const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                                    const val = input.value.trim();
                                    if (val) promptModal.onSubmit(val);
                                }}
                                className="px-3 py-1.5 rounded bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
