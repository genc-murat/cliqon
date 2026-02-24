import React, { useState, useEffect } from 'react';
import { Key, Shield, Trash2, Send, Check, AlertCircle, RefreshCw, Smartphone, Plus, FileInput, Fingerprint, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { SshProfile } from '../../types/connection';
import { useConfirm } from '../../hooks/useConfirm';

interface RemoteKeyManagerProps {
    profile: SshProfile;
    sessionId: string;
}

interface LocalSshKey {
    id: string;
    name: string;
    key_type: string;
    public_key: string;
    created_at: string;
    fingerprint: string;
}

interface RemoteKey {
    raw: string;
    fingerprint: string;
    key_type: string;
    comment: string;
    bit_length: number;
}

export const RemoteKeyManager: React.FC<RemoteKeyManagerProps> = ({ profile, sessionId }) => {
    const confirm = useConfirm();
    const [remoteKeys, setRemoteKeys] = useState<RemoteKey[]>([]);
    const [localKeys, setLocalKeys] = useState<LocalSshKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [selectedLocalKey, setSelectedLocalKey] = useState<string>('');
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showLocalManager, setShowLocalManager] = useState(false);
    
    // Modals
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    
    // Form States
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState('ed25519');
    const [newKeyPassphrase, setNewKeyPassphrase] = useState('');
    const [importKeyContent, setImportKeyContent] = useState('');

    useEffect(() => {
        loadData();
    }, [sessionId]);

    const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [remote, local] = await Promise.all([
                api.getRemoteAuthorizedKeys(profile),
                api.listLocalKeys()
            ]);
            setRemoteKeys(remote);
            setLocalKeys(local);
            if (local.length > 0 && !selectedLocalKey) {
                setSelectedLocalKey(local[0].id);
            }
        } catch (err) {
            console.error('Failed to load keys:', err);
            showStatus('Failed to load keys from remote', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeploy = async () => {
        if (!selectedLocalKey) return;
        const key = localKeys.find(k => k.id === selectedLocalKey);
        if (!key) return;

        setDeploying(true);
        try {
            await api.deployKeyToRemote(profile, key.name, profile.username);
            showStatus('Key deployed successfully');
            await loadData();
        } catch (err) {
            showStatus('Deployment failed: ' + err, 'error');
        } finally {
            setDeploying(false);
        }
    };

    const handleRemoveRemote = async (publicKey: string) => {
        const isConfirmed = await confirm({
            title: 'Remove Authorized Key',
            message: 'Are you sure you want to remove this key from the remote server? You might lose access if this is your only way to connect.',
            confirmLabel: 'Remove Key',
            isDestructive: true
        });

        if (isConfirmed) {
            setLoading(true);
            try {
                await api.removeRemoteAuthorizedKey(profile, publicKey);
                showStatus('Key removed from server');
                await loadData();
            } catch (err) {
                showStatus('Failed to remove: ' + err, 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleGenerateKey = async () => {
        if (!newKeyName) return;
        setLoading(true);
        try {
            await api.generateSshKey(newKeyName, newKeyType, newKeyPassphrase || null);
            showStatus('Key generated successfully');
            setShowGenerateModal(false);
            setNewKeyName('');
            setNewKeyPassphrase('');
            await loadData();
        } catch (err) {
            showStatus('Generation failed: ' + err, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImportKey = async () => {
        if (!newKeyName || !importKeyContent) return;
        setLoading(true);
        try {
            await api.importSshKey(newKeyName, importKeyContent, newKeyPassphrase || null);
            showStatus('Key imported successfully');
            setShowImportModal(false);
            setNewKeyName('');
            setImportKeyContent('');
            setNewKeyPassphrase('');
            await loadData();
        } catch (err) {
            showStatus('Import failed: ' + err, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLocalKey = async (key: LocalSshKey) => {
        const isConfirmed = await confirm({
            title: 'Delete Local Key',
            message: `Are you sure you want to delete "${key.name}"? This will permanently delete the private and public key files from your computer.`,
            confirmLabel: 'Delete Permanently',
            isDestructive: true
        });

        if (isConfirmed) {
            setLoading(true);
            try {
                await api.deleteLocalKey(key.id, key.name);
                showStatus('Local key deleted');
                await loadData();
            } catch (err) {
                showStatus('Failed to delete: ' + err, 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]/50 shrink-0">
                <div className="flex items-center gap-2">
                    <Shield size={18} className="text-[var(--accent-color)]" />
                    <h3 className="text-sm font-bold text-[var(--text-main)]">SSH Key Management</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowLocalManager(!showLocalManager)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${showLocalManager ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--hover-color)] text-[var(--text-main)] hover:bg-[var(--border-color)]'}`}
                    >
                        Local Key Manager
                    </button>
                    {!showLocalManager && (
                        <>
                            <div className="w-[1px] h-6 bg-[var(--border-color)] mx-1" />
                            <select
                                value={selectedLocalKey}
                                onChange={(e) => setSelectedLocalKey(e.target.value)}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-medium rounded-lg px-3 py-1.5 outline-none focus:border-[var(--accent-color)] transition-colors cursor-pointer"
                                disabled={deploying || localKeys.length === 0}
                            >
                                {localKeys.length === 0 ? (
                                    <option>No local keys found</option>
                                ) : (
                                    localKeys.map(k => (
                                        <option key={k.id} value={k.id}>{k.name} ({k.key_type})</option>
                                    ))
                                )}
                            </select>
                            <button
                                onClick={handleDeploy}
                                disabled={deploying || !selectedLocalKey || localKeys.length === 0}
                                className="flex items-center gap-2 px-4 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {deploying ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                Deploy to Server
                            </button>
                        </>
                    )}
                    <div className="w-[1px] h-6 bg-[var(--border-color)] mx-1" />
                    <button
                        onClick={loadData}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                        title="Refresh keys"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {statusMsg && (
                <div className={`mx-4 mt-4 p-2 rounded-lg flex items-center justify-center gap-2 text-xs font-medium animate-in slide-in-from-top-2 z-10 ${statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {statusMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                    {statusMsg.text}
                </div>
            )}

            {showLocalManager ? (
                /* Local Key Manager View */
                <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-60">Manage Local Keys</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowGenerateModal(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[10px] font-bold rounded-md hover:bg-[var(--accent-color)]/20 transition-all"
                            >
                                <Plus size={12} /> Generate
                            </button>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--hover-color)] text-[var(--text-main)] text-[10px] font-bold rounded-md hover:bg-[var(--border-color)] transition-all"
                            >
                                <FileInput size={12} /> Import
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                        {localKeys.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--bg-sidebar)]/30 border border-dashed border-[var(--border-color)] rounded-xl">
                                <Key size={32} className="text-[var(--text-muted)] mb-3 opacity-30" />
                                <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">No Local Keys</h4>
                                <p className="text-[10px] text-[var(--text-muted)] max-w-[200px]">Generate or import an SSH key to get started.</p>
                            </div>
                        ) : (
                            localKeys.map((key) => (
                                <div key={key.id} className="group flex items-start gap-3 p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl hover:border-[var(--text-muted)] transition-all">
                                    <div className="mt-0.5 p-1.5 bg-[var(--accent-color)]/10 text-[var(--accent-color)] rounded-lg shrink-0">
                                        <Key size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs font-bold text-[var(--text-main)] truncate">{key.name}</span>
                                                <span className="px-1.5 py-0.5 bg-black/30 text-[9px] font-mono font-bold text-[var(--text-muted)] rounded border border-white/5 uppercase">{key.key_type}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteLocalKey(key)}
                                                className="p-1 px-1.5 text-xs text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
                                                <Fingerprint size={10} className="opacity-50" />
                                                <span className="font-mono opacity-80">{key.fingerprint}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
                                                <Calendar size={10} className="opacity-50" />
                                                <span className="opacity-80">Created: {new Date(key.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* Remote Keys View */
                <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
                    <div className="px-4 py-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-60">
                        <span>Authorized Keys on {profile.name}</span>
                        <span>{remoteKeys.length} Total</span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                        {loading && remoteKeys.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
                                <RefreshCw size={24} className="animate-spin" />
                                <span className="text-xs font-medium">Fetching remote keys...</span>
                            </div>
                        ) : remoteKeys.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--bg-sidebar)]/30 border border-dashed border-[var(--border-color)] rounded-xl">
                                <Smartphone size={32} className="text-[var(--text-muted)] mb-3 opacity-30" />
                                <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">No Authorized Keys</h4>
                                <p className="text-[10px] text-[var(--text-muted)] max-w-[200px]">We couldn't find any authorized keys. You may be using password authentication.</p>
                            </div>
                        ) : (
                            remoteKeys.map((key, idx) => {
                                const isSelf = localKeys.some(lk => lk.fingerprint === key.fingerprint);

                                return (
                                    <div key={idx} className="group flex items-start gap-3 p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl hover:border-[var(--text-muted)] transition-all">
                                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isSelf ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]' : 'bg-[var(--hover-color)] text-[var(--text-muted)]'}`}>
                                            <Key size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-bold text-[var(--text-main)] truncate">{key.comment || 'No comment'}</span>
                                                    {isSelf && (
                                                        <span className="px-1.5 py-0.5 bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-[9px] font-black uppercase rounded">Your Key</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveRemote(key.raw)}
                                                    className="p-1 px-1.5 text-xs text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                    title="Remove from server"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="px-1.5 py-0.5 bg-black/30 text-[9px] font-mono font-bold text-[var(--text-muted)] rounded border border-white/5 uppercase">
                                                    {key.key_type} {key.bit_length > 0 ? `${key.bit_length}-bit` : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] opacity-60">
                                                <Fingerprint size={10} />
                                                <span className="font-mono truncate">{key.fingerprint}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-2">
                            <Plus size={18} className="text-[var(--accent-color)]" />
                            <h3 className="text-sm font-bold text-[var(--text-main)]">Generate SSH Key</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Key Name</label>
                                <input
                                    type="text"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. work_laptop"
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Key Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['ed25519', 'rsa', 'ecdsa'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setNewKeyType(t)}
                                            className={`px-2 py-1.5 text-[10px] font-bold rounded-md border transition-all ${newKeyType === t ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--accent-color)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'}`}
                                        >
                                            {t.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Passphrase (Optional)</label>
                                <input
                                    type="password"
                                    value={newKeyPassphrase}
                                    onChange={(e) => setNewKeyPassphrase(e.target.value)}
                                    placeholder="Leave empty for no passphrase"
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-all"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-[var(--bg-primary)]/50 border-t border-[var(--border-color)] flex justify-end gap-2">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="px-4 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateKey}
                                disabled={!newKeyName || loading}
                                className="px-4 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                                Generate Key
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-2">
                            <FileInput size={18} className="text-[var(--accent-color)]" />
                            <h3 className="text-sm font-bold text-[var(--text-main)]">Import Private Key</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Key Name</label>
                                <input
                                    type="text"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. legacy_server_key"
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Private Key Content</label>
                                <textarea
                                    value={importKeyContent}
                                    onChange={(e) => setImportKeyContent(e.target.value)}
                                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                                    className="w-full h-32 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-all resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Passphrase (If encrypted)</label>
                                <input
                                    type="password"
                                    value={newKeyPassphrase}
                                    onChange={(e) => setNewKeyPassphrase(e.target.value)}
                                    placeholder="Leave empty if not encrypted"
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-color)] transition-all"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-[var(--bg-primary)]/50 border-t border-[var(--border-color)] flex justify-end gap-2">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-4 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImportKey}
                                disabled={!newKeyName || !importKeyContent || loading}
                                className="px-4 py-1.5 bg-[var(--accent-color)] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                                Import Key
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
