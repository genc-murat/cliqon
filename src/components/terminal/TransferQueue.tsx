import React, { useState, useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { X, ArrowUpCircle, ArrowDownCircle, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export interface TransferJob {
    id: string;
    name: string;
    type: 'upload' | 'download' | 'download_zip';
    total: number;
    progress: number;
    status: 'pending' | 'transferring' | 'done' | 'error';
    error?: string;
}

interface TransferQueueProps {
    sessionId: string;
}

export const TransferQueue: React.FC<TransferQueueProps> = ({ sessionId }) => {
    const [jobs, setJobs] = useState<TransferJob[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        let unlistenStart: UnlistenFn;
        let unlistenProgress: UnlistenFn;
        let unlistenDone: UnlistenFn;
        let unlistenError: UnlistenFn;

        const setupListeners = async () => {
            unlistenStart = await listen<any>(`sftp_transfer_start_${sessionId}`, (event) => {
                const payload = event.payload;
                if (typeof payload === 'object' && payload.id) {
                    setJobs(prev => {
                        // Prevent duplicates
                        if (prev.find(j => j.id === payload.id)) return prev;
                        return [...prev, {
                            id: payload.id,
                            name: payload.name,
                            type: payload.type,
                            total: payload.total,
                            progress: 0,
                            status: 'transferring'
                        }];
                    });
                    setIsExpanded(true); // Auto-expand on new transfer
                }
            });

            unlistenProgress = await listen<any>(`sftp_transfer_progress_${sessionId}`, (event) => {
                const payload = event.payload;
                if (payload.id) {
                    setJobs(prev => prev.map(job =>
                        job.id === payload.id ? { ...job, progress: payload.progress } : job
                    ));
                }
            });

            unlistenDone = await listen<any>(`sftp_transfer_done_${sessionId}`, (event) => {
                const payload = event.payload;
                if (payload.id) {
                    setJobs(prev => prev.map(job =>
                        job.id === payload.id ? { ...job, status: 'done', progress: job.total || job.progress } : job
                    ));
                }
            });

            unlistenError = await listen<any>(`sftp_transfer_error_${sessionId}`, (event) => {
                const payload = event.payload;
                if (payload.id) {
                    setJobs(prev => prev.map(job =>
                        job.id === payload.id ? { ...job, status: 'error', error: payload.error } : job
                    ));
                }
            });
        };

        setupListeners();

        return () => {
            unlistenStart?.();
            unlistenProgress?.();
            unlistenDone?.();
            unlistenError?.();
        };
    }, [sessionId]);

    const activeCount = jobs.filter(j => j.status === 'transferring').length;

    if (jobs.length === 0) return null;

    const clearCompleted = () => {
        setJobs(prev => prev.filter(j => j.status === 'transferring'));
    };

    const removeJob = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setJobs(prev => prev.filter(j => j.id !== id));
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 flex flex-col bg-[var(--bg-primary)] border-t border-[var(--border-color)] z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
            {/* Header */}
            <div
                className="flex items-center justify-between p-2.5 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] cursor-pointer select-none hover:bg-[var(--hover-color)] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-2">
                    {activeCount > 0 ? (
                        <div className="relative">
                            <div className="w-2 h-2 bg-[var(--accent-color)] rounded-full animate-ping absolute"></div>
                            <div className="w-2 h-2 bg-[var(--accent-color)] rounded-full"></div>
                        </div>
                    ) : (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                    <span className="text-xs font-medium text-[var(--text-main)] truncate">
                        {activeCount > 0 ? `${activeCount} active transfers` : 'Transfers completed'}
                    </span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                    {jobs.some(j => j.status !== 'transferring') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
                            className="p-1 hover:bg-[var(--hover-color)] rounded text-[var(--text-muted)] hover:text-red-400"
                            title="Clear completed"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    {isExpanded ? <ChevronDown size={16} className="text-[var(--text-muted)] p-0.5" /> : <ChevronUp size={16} className="text-[var(--text-muted)] p-0.5" />}
                </div>
            </div>

            {/* List */}
            {isExpanded && (
                <div className="max-h-64 overflow-y-auto p-2 space-y-2 bg-[var(--bg-primary)] custom-scrollbar">
                    {jobs.map(job => (
                        <div key={job.id} className="relative bg-[var(--bg-sidebar)] rounded p-2 text-xs border border-[var(--border-color)] group">
                            <div className="flex items-start justify-between mb-1.5">
                                <div className="flex items-center space-x-2 overflow-hidden">
                                    {job.type === 'upload' ? (
                                        <ArrowUpCircle size={13} className="text-[var(--accent-color)] shrink-0" />
                                    ) : (
                                        <ArrowDownCircle size={13} className="text-green-500 shrink-0" />
                                    )}
                                    <span className="text-[var(--text-main)] truncate" title={job.name}>{job.name}</span>
                                </div>
                                <button
                                    onClick={(e) => removeJob(job.id, e)}
                                    className="text-[var(--text-muted)] hover:text-red-400 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={13} />
                                </button>
                            </div>

                            {/* Progress & Status */}
                            {job.status === 'transferring' ? (
                                <div className="space-y-1.5 mt-2">
                                    <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                                        <span>{job.total > 0 ? `${Math.round((job.progress / job.total) * 100)}%` : 'Transferring...'}</span>
                                        <span>{job.total > 0 ? `${formatBytes(job.progress)} / ${formatBytes(job.total)}` : formatBytes(job.progress)}</span>
                                    </div>
                                    {job.total > 0 && (
                                        <div className="h-1 w-full bg-[var(--hover-color)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[var(--accent-color)] rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(100, (job.progress / job.total) * 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : job.status === 'done' ? (
                                <div className="flex items-center space-x-1 text-green-500 text-[10px]">
                                    <CheckCircle size={11} />
                                    <span>Completed</span>
                                </div>
                            ) : (
                                <div className="flex flex-col text-red-400 text-[10px] mt-1">
                                    <div className="flex items-center space-x-1">
                                        <AlertCircle size={11} />
                                        <span>Failed</span>
                                    </div>
                                    <span className="truncate mt-0.5" title={job.error}>{job.error}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
