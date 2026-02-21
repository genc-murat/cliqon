import React, { useEffect, useState, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
    Folder, File as FileIcon, ArrowUpCircle, RefreshCw, ChevronLeft, ChevronRight,
    Download, Trash2, Edit2, Copy, Settings, TerminalSquare
} from 'lucide-react';
import { SshProfile, FileNode } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';
import { FilePropertiesModal } from './FilePropertiesModal';

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

export const FileBrowser: React.FC<FileBrowserProps> = ({ profile, sessionId, isActive }) => {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string>('.');
    const [files, setFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [renamingFile, setRenamingFile] = useState<FileNode | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [propsModal, setPropsModal] = useState<string | null>(null); // path
    const [statusMsg, setStatusMsg] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const { width, startResizing, isResizing } = useResizable(256, 160, 600);

    const toggleCollapse = () => {
        setIsCollapsed(prev => !prev);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
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

        const setupSftp = async () => {
            try {
                unlistenRx = await listen<FileNode[]>(`sftp_dir_rx_${sessionId}`, (event) => {
                    if (isMounted) { setFiles(event.payload); setIsLoading(false); }
                });
                unlistenTransferDone = await listen<string>(`sftp_transfer_done_${sessionId}`, () => {
                    if (isMounted) fetchDirectory(currentPath);
                });
                unlistenRenameDone = await listen<string>(`sftp_rename_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ Renamed'); }
                });
                unlistenRenameErr = await listen<string>(`sftp_rename_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Rename failed: ${e.payload}`);
                });
                unlistenDeleteDone = await listen<string>(`sftp_delete_done_${sessionId}`, () => {
                    if (isMounted) { fetchDirectory(currentPath); showStatus('✅ Deleted'); }
                });
                unlistenDeleteErr = await listen<string>(`sftp_delete_error_${sessionId}`, (e) => {
                    if (isMounted) showStatus(`❌ Delete failed: ${e.payload}`);
                });

                await api.connectSftp(profile, sessionId);
                if (isMounted) { setConnected(true); fetchDirectory(currentPath); }
            } catch (err: any) {
                if (isMounted) setError(`SFTP Error: ${err}`);
            }
        };

        setupSftp();

        return () => {
            isMounted = false;
            [unlistenRx, unlistenTransferDone, unlistenRenameDone, unlistenRenameErr,
                unlistenDeleteDone, unlistenDeleteErr].forEach(u => u?.());
            api.closeSftp(sessionId).catch(console.error);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, sessionId]);

    const handleNavigate = (node: FileNode) => {
        if (node.is_dir) { setCurrentPath(node.path); fetchDirectory(node.path); }
    };

    const handleUpDirectory = () => {
        if (currentPath === '.' || currentPath === '/') return;
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
        setCurrentPath(newPath);
        fetchDirectory(newPath);
    };

    // Drag-and-drop upload
    useEffect(() => {
        if (!isActive) return;
        let unlistenDrop: UnlistenFn | null = null;
        let isSubscribed = true;
        const setupDrop = async () => {
            const unlisten = await listen<{ paths: string[] }>('tauri://drop', (event) => {
                if (!isActive || !connected) return;
                for (const localPath of event.payload.paths) {
                    const filename = localPath.split(/[/\\]/).pop();
                    if (filename) {
                        const remotePath = `${currentPath === '/' ? '' : currentPath}/${filename}`;
                        api.uploadSftp(sessionId, localPath, remotePath).catch(console.error);
                    }
                }
            });
            if (isSubscribed) unlistenDrop = unlisten; else unlisten();
        };
        setupDrop();
        return () => { isSubscribed = false; unlistenDrop?.(); };
    }, [isActive, connected, currentPath, sessionId]);

    const handleContextMenu = (e: React.MouseEvent, file: FileNode) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, file });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Context menu actions
    const handleDownload = async (file: FileNode) => {
        closeContextMenu();
        // Use a simple prompt for the local save path (no native dialog plugin required)
        const defaultPath = file.name;
        const savePath = window.prompt(`Save "${file.name}" to local path:`, defaultPath);
        if (savePath) {
            await api.downloadSftp(sessionId, file.path, savePath);
            showStatus(`⬇️ Downloading ${file.name}...`);
        }
    };

    const handleDelete = async (file: FileNode) => {
        closeContextMenu();
        if (!window.confirm(`Delete "${file.name}"?`)) return;
        await api.deleteSftp(sessionId, file.path, file.is_dir);
    };

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
        await api.renameSftp(sessionId, renamingFile.path, newPath);
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

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
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
                    className="absolute -right-3 top-3 z-50 w-6 h-6 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-sm transition-colors"
                    title={isCollapsed ? 'Expand SFTP browser' : 'Collapse SFTP browser'}
                >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                </button>

                {isCollapsed ? (
                    <div className="flex flex-col items-center pt-3">
                        <Folder size={18} className="text-[var(--accent-color)]" />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <button
                                    onClick={handleUpDirectory}
                                    disabled={currentPath === '.' || currentPath === '/'}
                                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded disabled:opacity-50"
                                >
                                    <ArrowUpCircle size={16} />
                                </button>
                                <span className="text-xs font-mono text-[var(--text-muted)] truncate" title={currentPath}>
                                    {currentPath}
                                </span>
                            </div>
                            <button
                                onClick={() => fetchDirectory(currentPath)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded"
                            >
                                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {/* Status bar */}
                        {statusMsg && (
                            <div className="px-3 py-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                {statusMsg}
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
                                files.map((file, i) => (
                                    <div
                                        key={i}
                                        onDoubleClick={() => handleNavigate(file)}
                                        onContextMenu={(e) => handleContextMenu(e, file)}
                                        className="flex items-center gap-2 p-1.5 hover:bg-[var(--hover-color)] rounded cursor-pointer group select-none"
                                    >
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
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[var(--text-main)] hover:bg-[var(--hover-color)]"
                            >
                                <Download size={14} className="text-[var(--accent-color)]" /> Download
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
        </>
    );
};
