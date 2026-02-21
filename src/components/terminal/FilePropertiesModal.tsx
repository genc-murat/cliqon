import React, { useEffect, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { X, Shield, Folder, File as FileIcon, RefreshCw } from 'lucide-react';
import { FileProperties } from '../../types/connection';
import { api } from '../../services/api';

interface FilePropertiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    filePath: string;
    sessionId: string;
    onChmodDone: () => void;
}

const PERM_BITS = [
    { label: 'Owner', read: 0o400, write: 0o200, exec: 0o100 },
    { label: 'Group', read: 0o040, write: 0o020, exec: 0o010 },
    { label: 'Other', read: 0o004, write: 0o002, exec: 0o001 },
];

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(unix: number): string {
    return new Date(unix * 1000).toLocaleString();
}

export const FilePropertiesModal: React.FC<FilePropertiesModalProps> = ({
    isOpen, onClose, filePath, sessionId, onChmodDone
}) => {
    const [props, setProps] = useState<FileProperties | null>(null);
    const [mode, setMode] = useState(0);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        if (!isOpen || !filePath) return;
        setProps(null);
        setStatusMsg('');
        let unlistenStat: UnlistenFn | null = null;

        const setup = async () => {
            unlistenStat = await listen<FileProperties>(`sftp_stat_rx_${sessionId}`, (e) => {
                setProps(e.payload);
                setMode(e.payload.permissions);
            });
            await api.statSftp(sessionId, filePath);
        };
        setup();
        return () => { if (unlistenStat) unlistenStat(); };
    }, [isOpen, filePath, sessionId]);

    const toggleBit = (bit: number) => {
        setMode(prev => prev ^ bit);
    };

    const handleApply = async () => {
        setSaving(true);
        setStatusMsg('');
        let unlistenDone: UnlistenFn | undefined;
        let unlistenErr: UnlistenFn | undefined;
        try {
            await new Promise<void>(async (resolve, reject) => {
                unlistenDone = await listen(`sftp_chmod_done_${sessionId}`, () => resolve());
                unlistenErr = await listen<string>(`sftp_chmod_error_${sessionId}`, (e) => reject(e.payload));
                await api.chmodSftp(sessionId, filePath, mode);
            });
            setStatusMsg('✅ Permissions updated');
            onChmodDone();
        } catch (err: any) {
            setStatusMsg(`❌ ${err}`);
        } finally {
            setSaving(false);
            unlistenDone?.();
            unlistenErr?.();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
                    <div className="flex items-center gap-2 text-[var(--text-main)]">
                        {props?.is_dir ? <Folder size={18} className="text-[var(--accent-color)]" /> : <FileIcon size={18} className="text-[var(--accent-color)]" />}
                        <h2 className="font-semibold text-sm truncate max-w-xs">{props?.name ?? 'Loading...'}</h2>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {!props ? (
                        <div className="flex items-center justify-center py-8 text-[var(--text-muted)] gap-2">
                            <RefreshCw size={16} className="animate-spin" /> Loading...
                        </div>
                    ) : (
                        <>
                            {/* File Info */}
                            <section>
                                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Details</h3>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <span className="text-[var(--text-muted)]">Path</span>
                                    <span className="text-[var(--text-main)] font-mono text-xs truncate" title={props.path}>{props.path}</span>
                                    <span className="text-[var(--text-muted)]">Type</span>
                                    <span className="text-[var(--text-main)]">{props.is_dir ? 'Directory' : 'File'}</span>
                                    <span className="text-[var(--text-muted)]">Size</span>
                                    <span className="text-[var(--text-main)]">{formatSize(props.size)}</span>
                                    <span className="text-[var(--text-muted)]">Modified</span>
                                    <span className="text-[var(--text-main)]">{formatDate(props.modified_at)}</span>
                                    <span className="text-[var(--text-muted)]">UID / GID</span>
                                    <span className="text-[var(--text-main)] font-mono">{props.uid} / {props.gid}</span>
                                </div>
                            </section>

                            {/* Permissions Editor */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                                        <Shield size={13} /> Permissions
                                    </h3>
                                    <span className="font-mono text-sm text-[var(--accent-color)]">
                                        {mode.toString(8).padStart(3, '0')}
                                    </span>
                                </div>
                                <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[var(--bg-sidebar)] text-[var(--text-muted)] text-xs">
                                                <th className="text-left px-3 py-2">Role</th>
                                                <th className="text-center px-3 py-2">Read</th>
                                                <th className="text-center px-3 py-2">Write</th>
                                                <th className="text-center px-3 py-2">Execute</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {PERM_BITS.map(({ label, read, write, exec }) => (
                                                <tr key={label} className="border-t border-[var(--border-color)]">
                                                    <td className="px-3 py-2 text-[var(--text-main)] font-medium">{label}</td>
                                                    {[read, write, exec].map((bit) => (
                                                        <td key={bit} className="text-center px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!(mode & bit)}
                                                                onChange={() => toggleBit(bit)}
                                                                className="w-4 h-4 text-[var(--accent-color)] rounded"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
                                    {PERM_BITS.map(({ read, write, exec }) =>
                                        [(mode & read ? 'r' : '-'), (mode & write ? 'w' : '-'), (mode & exec ? 'x' : '-')].join('')
                                    ).join('')}
                                </p>
                            </section>

                            {statusMsg && (
                                <p className="text-xs text-center text-[var(--text-muted)]">{statusMsg}</p>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] flex justify-end gap-3">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">Close</button>
                    {props && (
                        <button
                            onClick={handleApply}
                            disabled={saving}
                            className="px-4 py-1.5 bg-[var(--accent-color)] hover:opacity-90 text-white text-sm font-medium rounded-md transition-opacity disabled:opacity-50"
                        >
                            {saving ? 'Applying...' : 'Apply Permissions'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
