import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { X, Save, RefreshCw, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

interface TextEditorModalProps {
    sessionId: string;
    filePath: string;
    fileName: string;
    onClose: () => void;
}

// Detect file type for syntax hints
const getLanguageHint = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        js: 'javascript', ts: 'typescript', tsx: 'tsx', jsx: 'jsx',
        py: 'python', rs: 'rust', go: 'go', rb: 'ruby',
        sh: 'bash', bash: 'bash', zsh: 'bash',
        json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
        md: 'markdown', html: 'html', css: 'css', xml: 'xml',
        sql: 'sql', conf: 'conf', cfg: 'conf', ini: 'ini',
        txt: 'plain text', log: 'log',
    };
    return map[ext] ?? (ext || 'plain text');
};

export const TextEditorModal: React.FC<TextEditorModalProps> = ({
    sessionId, filePath, fileName, onClose,
}) => {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isDirty = content !== originalContent;
    const lang = getLanguageHint(fileName);

    const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 3000);
    };

    const loadFile = useCallback(async () => {
        setLoading(true);
        setError(null);

        let unlistenOk: UnlistenFn | undefined;
        let unlistenErr: UnlistenFn | undefined;

        try {
            await new Promise<void>(async (resolve, reject) => {
                unlistenOk = await listen<string>(`sftp_readfile_rx_${sessionId}`, (e) => {
                    setContent(e.payload);
                    setOriginalContent(e.payload);
                    resolve();
                });
                unlistenErr = await listen<string>(`sftp_readfile_error_${sessionId}`, (e) => {
                    reject(new Error(e.payload));
                });
                await api.readSftpFile(sessionId, filePath);
            });
        } catch (e: any) {
            setError(e.message ?? String(e));
        } finally {
            setLoading(false);
            unlistenOk?.();
            unlistenErr?.();
        }
    }, [sessionId, filePath]);

    const handleSave = async () => {
        setSaving(true);

        let unlistenOk: UnlistenFn | undefined;
        let unlistenErr: UnlistenFn | undefined;

        try {
            await new Promise<void>(async (resolve, reject) => {
                unlistenOk = await listen(`sftp_writefile_done_${sessionId}`, () => resolve());
                unlistenErr = await listen<string>(`sftp_writefile_error_${sessionId}`, (e) => reject(new Error(e.payload)));
                await api.writeSftpFile(sessionId, filePath, content);
            });
            setOriginalContent(content);
            showStatus('✅ File saved successfully', 'success');
        } catch (e: any) {
            showStatus(`❌ Save failed: ${e.message ?? e}`, 'error');
        } finally {
            setSaving(false);
            unlistenOk?.();
            unlistenErr?.();
        }
    };

    // Keyboard shortcut: Ctrl+S to save
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (!saving && !loading && isDirty) handleSave();
            }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [saving, loading, isDirty, content]);

    useEffect(() => { loadFile(); }, [loadFile]);

    // Auto-focus textarea when loaded
    useEffect(() => {
        if (!loading && !error) {
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [loading, error]);

    // Handle Tab key in textarea (insert spaces instead of losing focus)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newContent = content.substring(0, start) + '    ' + content.substring(end);
            setContent(newContent);
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 4;
            });
        }
    };

    const lineCount = content.split('\n').length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col w-full max-w-5xl h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-[var(--accent-color)] shrink-0" />
                        <span className="text-sm font-semibold text-[var(--text-main)] truncate" title={filePath}>
                            {fileName}
                        </span>
                        {isDirty && (
                            <span className="text-xs text-amber-400 shrink-0">● unsaved</span>
                        )}
                        <span className="text-xs text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--hover-color)] shrink-0">
                            {lang}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={loadFile}
                            disabled={loading}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-md transition-colors disabled:opacity-40"
                            title="Reload file"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading || !isDirty}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                            title="Save (Ctrl+S)"
                        >
                            <Save size={13} />
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-md transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]">
                            <RefreshCw size={20} className="animate-spin mr-2" />
                            <span className="text-sm">Loading…</span>
                        </div>
                    ) : error ? (
                        <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-red-400 p-6">
                            <AlertCircle size={32} />
                            <p className="text-sm text-center">{error}</p>
                            <button
                                onClick={loadFile}
                                className="text-xs px-3 py-1.5 rounded-md bg-[var(--hover-color)] text-[var(--text-main)] hover:bg-[var(--accent-color)]/20 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div className="flex h-full">
                            {/* Line numbers */}
                            <div
                                className="select-none text-right pr-3 pl-2 pt-3 text-[11px] leading-[1.6] text-[var(--text-muted)] bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] overflow-hidden min-w-[3rem] shrink-0"
                                aria-hidden
                            >
                                {Array.from({ length: lineCount }, (_, i) => (
                                    <div key={i + 1}>{i + 1}</div>
                                ))}
                            </div>
                            {/* Editor */}
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                spellCheck={false}
                                className="flex-1 resize-none bg-[var(--bg-primary)] text-[var(--text-main)] text-xs leading-[1.6] p-3 font-mono outline-none overflow-auto"
                                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace" }}
                            />
                        </div>
                    )}
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] text-[10px] text-[var(--text-muted)] shrink-0">
                    <span>{filePath}</span>
                    <div className="flex items-center gap-4">
                        {statusMsg && (
                            <span className={`flex items-center gap-1 ${statusMsg.type === 'success' ? 'text-green-400' : statusMsg.type === 'error' ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                                {statusMsg.type === 'success' && <CheckCircle size={10} />}
                                {statusMsg.type === 'error' && <AlertCircle size={10} />}
                                {statusMsg.text}
                            </span>
                        )}
                        <span>{lineCount} lines</span>
                        <span>Ctrl+S to save</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
