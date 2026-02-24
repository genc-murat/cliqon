import React, { useState, useEffect } from 'react';
import { Key, Shield, Trash2, Send, Check, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
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
}

export const RemoteKeyManager: React.FC<RemoteKeyManagerProps> = ({ profile, sessionId }) => {
    const confirm = useConfirm();
    const [remoteKeys, setRemoteKeys] = useState<string[]>([]);
    const [localKeys, setLocalKeys] = useState<LocalSshKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [selectedLocalKey, setSelectedLocalKey] = useState<string>('');
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]/50 shrink-0">
                <div className="flex items-center gap-2">
                    <Shield size={18} className="text-[var(--accent-color)]" />
                    <h3 className="text-sm font-bold text-[var(--text-main)]">Key Deployment</h3>
                </div>
                <div className="flex items-center gap-3">
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
                    <div className="w-[1px] h-6 bg-[var(--border-color)] mx-1" />
                    <button
                        onClick={loadData}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                        title="Refresh remote keys"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {statusMsg && (
                <div className={`mx-4 mt-4 p-2 rounded-lg flex items-center justify-center gap-2 text-xs font-medium animate-in slide-in-from-top-2 ${statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {statusMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                    {statusMsg.text}
                </div>
            )}

            {/* List Header */}
            <div className="px-4 py-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-60">
                <span>Authorized Keys on {profile.name}</span>
                <span>{remoteKeys.length} Total</span>
            </div>

            {/* Key List */}
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
                        const parts = key.split(' ');
                        const type = parts[0];
                        const comment = parts.length > 2 ? parts[parts.length - 1] : 'No comment';
                        const isSelf = localKeys.some(lk => key.includes(lk.public_key.split(' ')[1]));

                        return (
                            <div key={idx} className="group flex items-start gap-3 p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl hover:border-[var(--text-muted)] transition-all">
                                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isSelf ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]' : 'bg-[var(--hover-color)] text-[var(--text-muted)]'}`}>
                                    <Key size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-[var(--text-main)] truncate">{comment}</span>
                                            {isSelf && (
                                                <span className="px-1.5 py-0.5 bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-[9px] font-black uppercase rounded">Local Key</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveRemote(key)}
                                            className="p-1 px-1.5 text-xs text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove from server"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="px-1.5 py-0.5 bg-black/30 text-[9px] font-mono font-bold text-[var(--text-muted)] rounded border border-white/5 uppercase">
                                            {type}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed opacity-50 break-all line-clamp-2">
                                        {key}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
