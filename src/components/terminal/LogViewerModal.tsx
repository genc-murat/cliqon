import React, { useState, useEffect, useRef, useMemo } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { X, RefreshCw, FileText, AlertCircle, Play, Square, Download, Search } from 'lucide-react';
import { api } from '../../services/api';
import { SshProfile } from '../../types/connection';

interface LogViewerModalProps {
    sessionId?: string; // Kept in interface to satisfy FileBrowser usage if passed, but optional
    profile: SshProfile;
    filePath: string;
    fileName: string;
    onClose: () => void;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
    profile, filePath, fileName, onClose
}) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isTailing, setIsTailing] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const logSessionId = `tail_` + Date.now(); // unique ID for backend

    // Start/Stop log tail
    useEffect(() => {
        let unlistenData: UnlistenFn | undefined;
        let unlistenErr: UnlistenFn | undefined;
        let unlistenClose: UnlistenFn | undefined;

        const start = async () => {
            setError(null);
            try {
                unlistenData = await listen<string>(`log_tail_rx_${logSessionId}`, (e) => {
                    if (e.payload) {
                        const newLines = e.payload.split('\n').filter(l => l.length > 0);
                        setLogs(prev => {
                            const combined = [...prev, ...newLines];
                            // keep last 5000 lines max to prevent extreme memory usage
                            if (combined.length > 5000) return combined.slice(combined.length - 5000);
                            return combined;
                        });
                    }
                });

                unlistenErr = await listen<string>(`log_tail_error_${logSessionId}`, (e) => {
                    setError(`Sync error: ${e.payload}`);
                    setIsTailing(false);
                });

                unlistenClose = await listen(`log_tail_close_${logSessionId}`, () => {
                    setIsTailing(false);
                });

                await api.startLogTail(profile, filePath, logSessionId);
            } catch (err: any) {
                setError(err.message || String(err));
                setIsTailing(false);
            }
        };

        if (isTailing) start();

        return () => {
            if (unlistenData) unlistenData();
            if (unlistenErr) unlistenErr();
            if (unlistenClose) unlistenClose();
            // Fire and forget stop
            api.stopLogTail(logSessionId).catch(() => { });
        };
    }, [isTailing, profile.id, filePath, logSessionId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            api.stopLogTail(logSessionId).catch(() => { });
        };
    }, [logSessionId]);

    // Auto-scroll logic
    useEffect(() => {
        if (autoScroll && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        // If user scrolled up, disable auto-scroll
        if (scrollTop + clientHeight < scrollHeight - 30) {
            setAutoScroll(false);
        } else {
            setAutoScroll(true);
        }
    };

    const toggleTail = () => {
        if (isTailing) {
            setIsTailing(false);
        } else {
            setLogs([]); // clear on restart? user preference... let's keep it.
            setIsTailing(true);
            setAutoScroll(true);
        }
    };

    const handleDownload = () => {
        const text = logs.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filteredLogs = useMemo(() => {
        if (!searchQuery) return logs;
        const q = searchQuery.toLowerCase();
        return logs.filter(line => line.toLowerCase().includes(q));
    }, [logs, searchQuery]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-[#1e1e1e] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col w-full max-w-6xl h-[85vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[#252526] shrink-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText size={16} className="text-blue-400 shrink-0" />
                        <span className="text-sm font-semibold text-[var(--text-main)] truncate" title={filePath}>
                            {fileName}
                        </span>

                        <div className="flex bg-[#333333] p-0.5 rounded-md border border-[var(--border-color)] ml-4 shrink-0">
                            <button
                                onClick={toggleTail}
                                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-colors ${isTailing ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                            >
                                {isTailing ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                {isTailing ? 'Stop Tailing' : 'Resume Tail'}
                            </button>
                        </div>

                        {error && (
                            <span className="text-xs text-red-400 flex items-center gap-1 shrink-0 ml-2 truncate">
                                <AlertCircle size={12} />
                                {error}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={12} />
                            <input
                                type="text"
                                placeholder="Filter logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-48 bg-[#333333] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded-md pl-7 pr-2 py-1 focus:outline-none focus:border-[var(--accent-color)]"
                            />
                        </div>
                        <button
                            onClick={handleDownload}
                            className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-md transition-colors"
                            title="Download Current Logs"
                        >
                            <Download size={15} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-md transition-colors ml-1"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div
                    className="flex-1 overflow-auto bg-[#1e1e1e] p-2"
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                >
                    {logs.length === 0 && !error ? (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm gap-2">
                            <RefreshCw size={16} className="animate-spin" /> Waiting for log data...
                        </div>
                    ) : (
                        <div className="font-mono text-xs leading-[1.4] text-[#d4d4d4] whitespace-pre-wrap word-break-all"
                            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" }}>
                            {filteredLogs.map((line, i) => (
                                <div key={i} className="hover:bg-white/5 px-2 py-0.5 border-l-2 border-transparent hover:border-[#007acc]">
                                    {line}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Status */}
                <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border-color)] bg-[#252526] text-[10px] text-[var(--text-muted)] shrink-0">
                    <div className="flex gap-4">
                        <span>Status: {isTailing ? <span className="text-green-400">Following</span> : <span className="text-red-400">Paused</span>}</span>
                        <span>Auto-scroll: {autoScroll ? 'On' : 'Off'}</span>
                    </div>
                    <span>{filteredLogs.length} lines shown {logs.length > filteredLogs.length && `(filtered from ${logs.length})`}</span>
                </div>
            </div>
        </div>
    );
};
