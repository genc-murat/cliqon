import React, { useState, useMemo } from 'react';
import { Play, Plus, Trash2, Code, ChevronLeft, ChevronRight, Folder, Copy } from 'lucide-react';
import { Snippet } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';
import { useSnippets } from '../../hooks/useSnippets';

interface SnippetManagerProps {
    sessionId: string;
    isActive: boolean;
}

export const SnippetManager: React.FC<SnippetManagerProps> = ({ sessionId, isActive }) => {
    const { width, startResizing, isResizing } = useResizable(240, 180, 450, 'right');
    const { snippets, saveSnippet, deleteSnippet } = useSnippets();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const [newName, setNewName] = useState('');
    const [newCommand, setNewCommand] = useState('');
    const [newFolder, setNewFolder] = useState('');
    const [newAutoRun, setNewAutoRun] = useState(true);

    const toggleCollapse = () => {
        setIsCollapsed(prev => !prev);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };

    // Group snippets by folder
    const groupedSnippets = useMemo(() => {
        const groups: Record<string, Snippet[]> = {
            'Uncategorized': []
        };
        snippets.forEach(s => {
            const folder = s.folder?.trim() || 'Uncategorized';
            if (!groups[folder]) groups[folder] = [];
            groups[folder].push(s);
        });
        return groups;
    }, [snippets]);

    const handleRunSnippet = (snippet: Snippet) => {
        if (!isActive) return;

        let commandToRun = snippet.command;
        if (snippet.auto_run) {
            commandToRun += '\n';
        }

        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(commandToRun));
        api.writeToPty(sessionId, bytes).catch(console.error);
    };

    const handleCopySnippet = (snippet: Snippet, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(snippet.command).catch(console.error);
    };

    const handleAddSnippet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !newCommand.trim()) return;

        const newSnippet: Snippet = {
            id: crypto.randomUUID(),
            name: newName.trim(),
            command: newCommand,
            folder: newFolder.trim() || null,
            auto_run: newAutoRun,
        };

        try {
            await saveSnippet(newSnippet);
            setIsAdding(false);
            setNewName('');
            setNewCommand('');
            setNewFolder('');
            setNewAutoRun(true);
        } catch (err) {
            console.error("Failed to save snippet", err);
        }
    };

    const handleDeleteSnippet = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this snippet?')) {
            try {
                await deleteSnippet(id);
            } catch (err) {
                console.error("Failed to delete snippet", err);
            }
        }
    };

    return (
        <div
            style={{ width: isCollapsed ? '36px' : `${width}px` }}
            className={`h-full bg-[var(--bg-sidebar)] border-l border-[var(--border-color)] flex flex-col shrink-0 relative transition-all duration-200 ${isResizing ? 'select-none pointer-events-none' : ''}`}
        >
            <button
                onClick={toggleCollapse}
                className="absolute -left-2 top-3 z-30 w-4 h-6 rounded-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-sm transition-colors"
                title={isCollapsed ? 'Expand snippets' : 'Collapse snippets'}
            >
                {isCollapsed ? <ChevronLeft size={11} strokeWidth={3} /> : <ChevronRight size={11} strokeWidth={3} />}
            </button>

            {isCollapsed ? (
                <div className="flex flex-col items-center pt-3">
                    <Code size={18} className="text-[var(--accent-color)]" />
                </div>
            ) : (
                <>
                    <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)] h-[44px]">
                        <div className="flex items-center gap-2">
                            <Code size={16} className="text-[var(--accent-color)]" />
                            <span className="text-sm font-medium text-[var(--text-main)]">Global Snippets</span>
                        </div>
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded"
                            title="Add Snippet"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto w-full p-2 space-y-3">
                        {isAdding && (
                            <form onSubmit={handleAddSnippet} className="p-3 border border-[var(--border-color)] rounded-md bg-[var(--bg-primary)] space-y-3 mb-4">
                                <div>
                                    <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Update System"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)]"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Folder (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Linux Updates"
                                        value={newFolder}
                                        onChange={(e) => setNewFolder(e.target.value)}
                                        className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Command</label>
                                    <textarea
                                        placeholder="sudo apt update && sudo apt upgrade -y"
                                        value={newCommand}
                                        onChange={(e) => setNewCommand(e.target.value)}
                                        className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-[var(--text-main)] font-mono resize-y min-h-[60px] focus:outline-none focus:border-[var(--accent-color)]"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="autoRun"
                                        checked={newAutoRun}
                                        onChange={(e) => setNewAutoRun(e.target.checked)}
                                        className="rounded border-[var(--border-color)] bg-[var(--bg-sidebar)] text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                                    />
                                    <label htmlFor="autoRun" className="text-xs text-[var(--text-main)] cursor-pointer">
                                        Auto-run (Append newline)
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdding(false)}
                                        className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newName.trim() || !newCommand.trim()}
                                        className="px-3 py-1 bg-[var(--accent-color)] text-white text-xs rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        Save Snippet
                                    </button>
                                </div>
                            </form>
                        )}

                        {snippets.length === 0 && !isAdding ? (
                            <div className="text-xs text-[var(--text-muted)] text-center mt-6 px-4">
                                No global snippets yet. Click the + button to build your library.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(groupedSnippets).sort(([a], [b]) => a.localeCompare(b)).map(([folder, folderSnippets]) => {
                                    if (folderSnippets.length === 0) return null;

                                    return (
                                        <div key={folder} className="space-y-1.5">
                                            <div className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                                {folder !== 'Uncategorized' && <Folder size={12} />}
                                                {folder}
                                            </div>
                                            <div className="space-y-1.5 pl-1">
                                                {folderSnippets.map((snippet) => (
                                                    <div
                                                        key={snippet.id}
                                                        className="group relative bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md hover:border-[var(--accent-color)] transition-colors"
                                                    >
                                                        <button
                                                            onClick={() => handleRunSnippet(snippet)}
                                                            className="w-full text-left p-2.5 flex items-start gap-2"
                                                            title={snippet.auto_run ? "Click to run instantly" : "Click to paste into terminal"}
                                                        >
                                                            <Play size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent-color)] shrink-0 mt-0.5" />
                                                            <div className="flex-1 min-w-0 pr-12">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-[var(--text-main)] truncate">
                                                                        {snippet.name}
                                                                    </span>
                                                                    {!snippet.auto_run && (
                                                                        <span className="text-[9px] bg-[var(--bg-sidebar)] px-1 rounded border border-[var(--border-color)] text-[var(--text-muted)]">
                                                                            Paste
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-[var(--text-muted)] font-mono truncate mt-1 bg-[var(--bg-sidebar)] rounded p-1">
                                                                    {snippet.command}
                                                                </div>
                                                            </div>
                                                        </button>

                                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-primary)] pl-2 pb-0.5">
                                                            <button
                                                                onClick={(e) => handleCopySnippet(snippet, e)}
                                                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-color)] rounded-md hover:bg-[var(--accent-color)]/10"
                                                                title="Copy command"
                                                            >
                                                                <Copy size={13} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteSnippet(snippet.id, e)}
                                                                className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-md hover:bg-red-400/10"
                                                                title="Delete snippet"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 -ml-1.5 cursor-col-resize hover:bg-[var(--accent-color)] z-30 transition-colors pointer-events-auto"
                        onMouseDown={startResizing}
                    >
                        <div className={`w-full h-full ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
                    </div>
                </>
            )}
        </div>
    );
};
