import React, { useState } from 'react';
import { Play, Plus, Trash2, Code, ChevronLeft, ChevronRight } from 'lucide-react';
import { SshProfile, Snippet } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';
import { useConnections } from '../../hooks/useConnections';

interface SnippetManagerProps {
    profile: SshProfile;
    sessionId: string;
    isActive: boolean;
}

export const SnippetManager: React.FC<SnippetManagerProps> = ({ profile, sessionId, isActive }) => {
    const { width, startResizing, isResizing } = useResizable(220, 150, 400, 'right');
    const { saveProfile } = useConnections();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCommand, setNewCommand] = useState('');

    const toggleCollapse = () => {
        setIsCollapsed(prev => !prev);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };

    const snippets = profile.snippets || [];

    const handleRunSnippet = (snippet: Snippet) => {
        if (!isActive) return;
        const commandToRun = snippet.command + '\n';
        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(commandToRun));
        api.writeToPty(sessionId, bytes).catch(console.error);
    };

    const handleAddSnippet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !newCommand.trim()) return;

        const newSnippet: Snippet = {
            id: crypto.randomUUID(),
            name: newName.trim(),
            command: newCommand.trim()
        };

        const updatedProfile = {
            ...profile,
            snippets: [...snippets, newSnippet]
        };

        try {
            await saveProfile(updatedProfile, undefined);
            setIsAdding(false);
            setNewName('');
            setNewCommand('');
        } catch (err) {
            console.error("Failed to save snippet", err);
        }
    };

    const handleDeleteSnippet = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedProfile = {
            ...profile,
            snippets: snippets.filter(s => s.id !== id)
        };
        try {
            await saveProfile(updatedProfile, undefined);
        } catch (err) {
            console.error("Failed to delete snippet", err);
        }
    };

    return (
        <div
            style={{ width: isCollapsed ? '36px' : `${width}px` }}
            className={`h-full bg-[var(--bg-sidebar)] border-l border-[var(--border-color)] flex flex-col shrink-0 relative transition-all duration-200 ${isResizing ? 'select-none pointer-events-none' : ''}`}
        >
            {/* Collapse Toggle on Left edge */}
            <button
                onClick={toggleCollapse}
                className="absolute -left-3 top-3 z-50 w-6 h-6 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-sm transition-colors"
                title={isCollapsed ? 'Expand snippets' : 'Collapse snippets'}
            >
                {isCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>

            {isCollapsed ? (
                /* Collapsed: icon only */
                <div className="flex flex-col items-center pt-3">
                    <Code size={18} className="text-[var(--accent-color)]" />
                </div>
            ) : (
                /* Expanded */
                <>
                    <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)] h-[44px]">
                        <div className="flex items-center gap-2">
                            <Code size={16} className="text-[var(--accent-color)]" />
                            <span className="text-sm font-medium text-[var(--text-main)]">Snippets</span>
                        </div>
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded"
                            title="Add Snippet"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto w-full p-2 space-y-2">
                        {isAdding && (
                            <form onSubmit={handleAddSnippet} className="p-3 border border-[var(--border-color)] rounded-md bg-[var(--bg-primary)] space-y-3 mb-4">
                                <input
                                    type="text"
                                    placeholder="Snippet Name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)]"
                                    autoFocus
                                />
                                <textarea
                                    placeholder="Command to run..."
                                    value={newCommand}
                                    onChange={(e) => setNewCommand(e.target.value)}
                                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-[var(--text-main)] font-mono resize-y min-h-[60px] focus:outline-none focus:border-[var(--accent-color)]"
                                />
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdding(false)}
                                        className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newName.trim() || !newCommand.trim()}
                                        className="px-3 py-1 bg-[var(--accent-color)] text-white text-xs rounded hover:opacity-90 disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                </div>
                            </form>
                        )}

                        {snippets.length === 0 && !isAdding ? (
                            <div className="text-xs text-[var(--text-muted)] text-center mt-6 px-4">
                                No snippets yet. Click the + button to add one.
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {snippets.map((snippet) => (
                                    <div
                                        key={snippet.id}
                                        className="group relative bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md hover:border-[var(--accent-color)] overflow-hidden transition-colors"
                                    >
                                        <button
                                            onClick={() => handleRunSnippet(snippet)}
                                            className="w-full text-left p-2.5 flex items-start gap-2"
                                            title="Click to run"
                                        >
                                            <Play size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent-color)] shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold text-[var(--text-main)] truncate">
                                                    {snippet.name}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-muted)] font-mono truncate mt-0.5 opacity-80 group-hover:opacity-100">
                                                    {snippet.command}
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={(e) => handleDeleteSnippet(snippet.id, e)}
                                            className="absolute right-1 top-1 p-1.5 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-400/10"
                                            title="Delete snippet"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Resize Handle */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 -ml-1.5 cursor-col-resize hover:bg-[var(--accent-color)] z-50 transition-colors pointer-events-auto"
                        onMouseDown={startResizing}
                    >
                        <div className={`w-full h-full ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
                    </div>
                </>
            )}
        </div>
    );
};
