import React, { useState, useEffect } from 'react';
import { List, Plus, Trash2, Edit2, Search, X, Loader2, Key } from 'lucide-react';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { SshProfile } from '../../types/connection';

interface EnvVar {
    key: string;
    value: string;
}

interface EnvManagerProps {
    profile: SshProfile;
}

export const EnvManager: React.FC<EnvManagerProps> = ({ profile }) => {
    const confirm = useConfirm();
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editingVar, setEditingVar] = useState<EnvVar | null>(null);

    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    useEffect(() => {
        loadEnvVars();
    }, [profile]);

    const loadEnvVars = async () => {
        setLoading(true);
        try {
            const result = await api.getEnvVars(profile);
            const lines = result.split('\n');
            const vars: EnvVar[] = lines
                .filter(line => line.includes('='))
                .map(line => {
                    const index = line.indexOf('=');
                    return {
                        key: line.substring(0, index),
                        value: line.substring(index + 1)
                    };
                })
                .sort((a, b) => a.key.localeCompare(b.key));
            setEnvVars(vars);
        } catch (err) {
            console.error('Failed to load environment variables:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveVar = async (e: React.FormEvent) => {
        e.preventDefault();
        const key = editingVar ? editingVar.key : newKey;
        const value = editingVar ? newValue : newValue;

        if (!key.trim()) return;

        setLoading(true);
        try {
            await api.setEnvVar(profile, key, value);
            setShowAdd(false);
            setEditingVar(null);
            setNewKey('');
            setNewValue('');
            await loadEnvVars();
        } catch (err) {
            console.error('Failed to save environment variable:', err);
            alert('Failed to save environment variable: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVar = async (envVar: EnvVar) => {
        const isConfirmed = await confirm({
            title: 'Delete Environment Variable',
            message: `Are you sure you want to delete "${envVar.key}"?\n\nNote: This will remove it from ~/.bashrc and the current session if possible.`,
            confirmLabel: 'Delete',
            isDestructive: true
        });

        if (isConfirmed) {
            setLoading(true);
            try {
                await api.deleteEnvVar(profile, envVar.key);
                await loadEnvVars();
            } catch (err) {
                console.error('Failed to delete environment variable:', err);
                alert('Failed to delete environment variable: ' + err);
            } finally {
                setLoading(false);
            }
        }
    };

    const filteredVars = envVars.filter(v =>
        v.key.toLowerCase().includes(filter.toLowerCase()) ||
        v.value.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="p-4 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                    <List size={18} className="text-[var(--accent-color)]" />
                    <h3 className="font-semibold text-[var(--text-main)]">Environment Variables</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-xs text-[var(--text-main)] w-48 focus:outline-none focus:border-[var(--accent-color)]"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setEditingVar(null);
                            setNewKey('');
                            setNewValue('');
                            setShowAdd(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-color)] text-white rounded-md text-sm hover:opacity-90 transition-opacity"
                    >
                        <Plus size={14} /> Add Var
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)]/30">
                {loading && envVars.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        <p className="text-sm">Loading environment variables...</p>
                    </div>
                ) : filteredVars.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] py-12">
                        <Search size={32} className="opacity-20 mb-2" />
                        <p className="text-sm">No environment variables found</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] z-10">
                            <tr>
                                <th className="px-4 py-2 font-semibold text-[var(--text-muted)] w-1/3">Key</th>
                                <th className="px-4 py-2 font-semibold text-[var(--text-muted)]">Value</th>
                                <th className="px-4 py-2 font-semibold text-[var(--text-muted)] w-20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]/50">
                            {filteredVars.map((v) => (
                                <tr key={v.key} className="hover:bg-[var(--hover-color)] transition-colors group">
                                    <td className="px-4 py-2 font-mono text-[var(--accent-color)] break-all">{v.key}</td>
                                    <td className="px-4 py-2 text-[var(--text-main)] break-all font-mono opacity-80">{v.value}</td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingVar(v);
                                                    setNewValue(v.value);
                                                    setShowAdd(true);
                                                }}
                                                className="p-1.5 hover:bg-[var(--accent-color)]/10 text-[var(--text-muted)] hover:text-[var(--accent-color)] rounded"
                                                title="Edit"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteVar(v)}
                                                className="p-1.5 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-5 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2">
                                <Key size={18} className="text-[var(--accent-color)]" />
                                {editingVar ? 'Edit Variable' : 'Add Environment Variable'}
                            </h3>
                            <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveVar} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Key</label>
                                <input
                                    type="text"
                                    value={editingVar ? editingVar.key : newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    disabled={!!editingVar}
                                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-[var(--text-main)] font-mono text-sm focus:border-[var(--accent-color)] outline-none disabled:opacity-50"
                                    placeholder="MY_VARIABLE_NAME"
                                    required
                                />
                                {editingVar && <p className="text-[10px] text-[var(--text-muted)] mt-1">Key cannot be changed. Delete and recreate if needed.</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Value</label>
                                <textarea
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-[var(--text-main)] font-mono text-sm min-h-[100px] resize-none focus:border-[var(--accent-color)] outline-none"
                                    placeholder="variable_value"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || (!editingVar && !newKey.trim())}
                                    className="px-6 py-2 bg-[var(--accent-color)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    {loading && <Loader2 size={14} className="animate-spin" />}
                                    {editingVar ? 'Save Changes' : 'Add Variable'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
