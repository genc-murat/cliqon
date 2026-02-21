import React, { useEffect, useState, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Folder, File as FileIcon, ArrowUpCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { SshProfile, FileNode } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';

interface FileBrowserProps {
    profile: SshProfile;
    sessionId: string;
    isActive: boolean;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ profile, sessionId, isActive }) => {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string>('.');
    const [files, setFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { width, startResizing, isResizing } = useResizable(256, 160, 600);

    const toggleCollapse = () => {
        setIsCollapsed(prev => !prev);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
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

        const setupSftp = async () => {
            try {
                // Setup listeners
                unlistenRx = await listen<FileNode[]>(`sftp_dir_rx_${sessionId}`, (event) => {
                    if (isMounted) {
                        setFiles(event.payload);
                        setIsLoading(false);
                    }
                });

                unlistenTransferDone = await listen<string>(`sftp_transfer_done_${sessionId}`, () => {
                    if (isMounted) {
                        // Refresh directory on transfer complete
                        fetchDirectory(currentPath);
                    }
                });

                // Connect
                await api.connectSftp(profile, sessionId);

                if (isMounted) {
                    setConnected(true);
                    fetchDirectory(currentPath);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(`SFTP Error: ${err}`);
                }
            }
        };

        setupSftp();

        return () => {
            isMounted = false;
            if (unlistenRx) unlistenRx();
            if (unlistenTransferDone) unlistenTransferDone();
            api.closeSftp(sessionId).catch(console.error);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, sessionId]);

    const handleNavigate = (node: FileNode) => {
        if (node.is_dir) {
            setCurrentPath(node.path);
            fetchDirectory(node.path);
        }
    };

    const handleUpDirectory = () => {
        if (currentPath === '.' || currentPath === '/') return;
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
        setCurrentPath(newPath);
        fetchDirectory(newPath);
    };

    // Listen for drop events for this specific tab using Tauri drop event
    useEffect(() => {
        if (!isActive) return;

        let unlistenDrop: UnlistenFn | null = null;
        let isSubscribed = true;

        const setupDrop = async () => {
            const unlisten = await listen<{ paths: string[] }>('tauri://drop', (event) => {
                if (!isActive || !connected) return;

                // Fire and forget uploads for each dropped file
                const paths = event.payload.paths;
                for (const localPath of paths) {
                    // Extract filename from localPath to append to current remote path
                    const filename = localPath.split(/[/\\]/).pop();
                    if (filename) {
                        const remotePath = `${currentPath === '/' ? '' : currentPath}/${filename}`;
                        api.uploadSftp(sessionId, localPath, remotePath).catch(err => {
                            console.error("Upload failed", err);
                        });
                    }
                }
            });

            if (isSubscribed) {
                unlistenDrop = unlisten;
            } else {
                unlisten();
            }
        };

        setupDrop();

        return () => {
            isSubscribed = false;
            if (unlistenDrop) unlistenDrop();
        };
    }, [isActive, connected, currentPath, sessionId]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div
            style={{ width: isCollapsed ? '36px' : `${width}px` }}
            className={`h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0 relative transition-all duration-200 ${isResizing ? 'select-none pointer-events-none' : ''}`}
        >
            {/* Collapse Toggle */}
            <button
                onClick={toggleCollapse}
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
                                    className="flex items-center gap-2 p-1.5 hover:bg-[var(--hover-color)] rounded cursor-pointer group"
                                >
                                    <div className="shrink-0 text-[var(--accent-color)]">
                                        {file.is_dir ? <Folder size={14} fill="currentColor" fillOpacity={0.2} /> : <FileIcon size={14} className="text-[var(--text-muted)]" />}
                                    </div>
                                    <div className="flex-1 truncate text-xs text-[var(--text-main)] group-hover:text-[var(--accent-color)] transition-colors">
                                        {file.name}
                                    </div>
                                    {!file.is_dir && (
                                        <div className="text-[10px] text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {formatSize(file.size)}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="h-8 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                        Drag files here to upload
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
    );
};
