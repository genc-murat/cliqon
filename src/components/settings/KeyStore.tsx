import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Upload, Copy, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';

interface SshKey {
    id: string;
    name: string;
    key_type: string;
    public_key: string;
    private_key_path: string;
    created_at: string;
}

export const KeyStore: React.FC = () => {
    const confirm = useConfirm();
    const [keys, setKeys] = useState<SshKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'list' | 'generate' | 'import'>('list');
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Form states
    const [newKey, setNewKey] = useState({ name: '', type: 'ed25519', passphrase: '' });
    const [importKey, setImportKey] = useState({ name: '', privateKey: '', passphrase: '' });
    const [showPassphrase, setShowPassphrase] = useState(false);

    useEffect(() => {
        loadKeys();
    }, []);

    const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 3000);
    };

    const loadKeys = async () => {
        setLoading(true);
        try {
            const localKeys = await api.listLocalKeys();
            setKeys(localKeys);
        } catch (err) {
            console.error('Failed to load keys:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKey.name.trim()) return;

        setLoading(true);
        try {
            await api.generateSshKey(newKey.name, newKey.type, newKey.passphrase || null);
            setNewKey({ name: '', type: 'ed25519', passphrase: '' });
            setView('list');
            showStatus('Key generated successfully');
            await loadKeys();
        } catch (err) {
            showStatus('Failed to generate: ' + err, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importKey.name.trim() || !importKey.privateKey.trim()) return;

        setLoading(true);
        try {
            await api.importSshKey(importKey.name, importKey.privateKey, importKey.passphrase || null);
            setImportKey({ name: '', privateKey: '', passphrase: '' });
            setView('list');
            showStatus('Key imported successfully');
            await loadKeys();
        } catch (err) {
            showStatus('Failed to import: ' + err, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (key: SshKey) => {
        const isConfirmed = await confirm({
            title: 'Delete SSH Key',
            message: `Are you sure you want to delete "${key.name}"? This will physically remove the key files from your device.`,
            confirmLabel: 'Delete Permanent',
            isDestructive: true
        });

        if (isConfirmed) {
            try {
                await api.deleteLocalKey(key.id, key.name);
                showStatus('Key deleted');
                await loadKeys();
            } catch (err) {
                showStatus('Failed to delete: ' + err, 'error');
            }
        }
    };

    const handleCopy = (key: SshKey) => {
        navigator.clipboard.writeText(key.public_key);
        showStatus('Public key copied');
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-main)] tracking-tight">Local SSH Keys</h3>
                    <p className="text-sm text-[var(--text-muted)]">Manage keys stored on this device. These can be used to authenticate with remote servers.</p>
                </div>
                <div className="flex gap-2">
                    {view === 'list' ? (
                        <>
                            <button
                                onClick={() => setView('generate')}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white text-sm font-bold rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:opacity-90 transition-all active:scale-95"
                            >
                                <Plus size={16} /> Generate
                            </button>
                            <button
                                onClick={() => setView('import')}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-bold rounded-xl hover:bg-[var(--hover-color)] transition-all active:scale-95"
                            >
                                <Upload size={16} /> Import
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setView('list')}
                            className="px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {statusMsg && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2 ${statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {statusMsg.text}
                </div>
            )}

            {view === 'list' && (
                <div className="grid grid-cols-1 gap-4">
                    {loading && keys.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-10 h-10 border-4 border-[var(--accent-color)]/20 border-t-[var(--accent-color)] rounded-full animate-spin" />
                            <span className="text-sm text-[var(--text-muted)] font-medium">Scaning keys...</span>
                        </div>
                    ) : keys.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-sidebar)]/30">
                            <div className="w-16 h-16 bg-[var(--hover-color)] rounded-full flex items-center justify-center text-[var(--text-muted)] mb-4">
                                <Key size={32} />
                            </div>
                            <h4 className="text-lg font-bold text-[var(--text-main)]">No SSH Keys Found</h4>
                            <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1">Start by generating a new secure key or importing an existing one.</p>
                        </div>
                    ) : (
                        keys.map(key => (
                            <div key={key.id} className="group relative bg-[var(--bg-sidebar)] border border-[var(--border-color)] p-4 rounded-2xl hover:border-[var(--accent-color)] transition-all duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[var(--accent-color)]/10 rounded-xl flex items-center justify-center text-[var(--accent-color)]">
                                            <Key size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-[var(--text-main)]">{key.name}</h4>
                                                <span className="px-2 py-0.5 bg-[var(--hover-color)] text-[10px] font-bold uppercase tracking-wider rounded-md text-[var(--text-muted)] border border-[var(--border-color)]">
                                                    {key.key_type}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 opacity-60">Created: {new Date(key.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleCopy(key)}
                                            className="p-2 text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 rounded-xl transition-all"
                                            title="Copy Public Key"
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(key)}
                                            className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                            title="Delete Key"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 font-mono text-[10px] text-[var(--text-muted)] break-all leading-relaxed whitespace-pre-wrap select-all">
                                    {key.public_key}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {view === 'generate' && (
                <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200">
                    <form onSubmit={handleGenerate} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Key Identity Name</label>
                                <input
                                    type="text"
                                    value={newKey.name}
                                    onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-sm"
                                    placeholder="e.g. mbp-work-key"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Algorithm</label>
                                <select
                                    value={newKey.type}
                                    onChange={(e) => setNewKey({ ...newKey, type: e.target.value })}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-sm cursor-pointer"
                                >
                                    <option value="ed25519">ED25519 (Recommended / Fast)</option>
                                    <option value="rsa">RSA (4096-bit / Classic)</option>
                                    <option value="ecdsa">ECDSA (Standard)</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Secure Passphrase (Optional)</label>
                            <div className="relative">
                                <input
                                    type={showPassphrase ? "text" : "password"}
                                    value={newKey.passphrase}
                                    onChange={(e) => setNewKey({ ...newKey, passphrase: e.target.value })}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 pr-12 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-sm"
                                    placeholder="Highly recommended for security"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassphrase(!showPassphrase)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                >
                                    {showPassphrase ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !newKey.name.trim()}
                                className="px-8 py-3 bg-[var(--accent-color)] text-white text-sm font-bold rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                            >
                                {loading ? 'Generating Secures Keys...' : 'Generate New Key Pair'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {view === 'import' && (
                <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200">
                    <form onSubmit={handleImport} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Import Name</label>
                            <input
                                type="text"
                                value={importKey.name}
                                onChange={(e) => setImportKey({ ...importKey, name: e.target.value })}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-sm"
                                placeholder="e.g. legacy-server-key"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Private Key Content</label>
                            <textarea
                                value={importKey.privateKey}
                                onChange={(e) => setImportKey({ ...importKey, privateKey: e.target.value })}
                                className="w-full h-40 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-xs font-mono text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-sm resize-none"
                                placeholder="Paste the content of your private key file here..."
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">Key Passphrase (if encrypted)</label>
                            <input
                                type="password"
                                value={importKey.passphrase}
                                onChange={(e) => setImportKey({ ...importKey, passphrase: e.target.value })}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-all shadow-sm"
                                placeholder="Enter passphrase"
                            />
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !importKey.name.trim() || !importKey.privateKey.trim()}
                                className="px-8 py-3 bg-[var(--accent-color)] text-white text-sm font-bold rounded-xl shadow-lg shadow-[var(--accent-color)]/20 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                            >
                                {loading ? 'Importing securely...' : 'Import Private Key'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
