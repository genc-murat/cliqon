import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Upload, Server, Copy, X, Eye, EyeOff } from 'lucide-react';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useConnections } from '../../hooks/useConnections';

interface SshKey {
    id: string;
    name: string;
    key_type: string;
    public_key: string;
    private_key_path: string;
    created_at: string;
}

interface KeyManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const KeyManager: React.FC<KeyManagerProps> = ({ isOpen, onClose }) => {
    const { profiles } = useConnections();
    const confirm = useConfirm();

    const [keys, setKeys] = useState<SshKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [showGenerate, setShowGenerate] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showDeploy, setShowDeploy] = useState(false);
    const [selectedKey, setSelectedKey] = useState<SshKey | null>(null);
    const [showPassphrase, setShowPassphrase] = useState(false);

    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState('ed25519');
    const [newKeyPassphrase, setNewKeyPassphrase] = useState('');

    const [importKeyName, setImportKeyName] = useState('');
    const [importPrivateKey, setImportPrivateKey] = useState('');
    const [importPassphrase, setImportPassphrase] = useState('');

    const [deployProfile, setDeployProfile] = useState('');
    const [deployUsername, setDeployUsername] = useState('');
    const [deployStatus, setDeployStatus] = useState('');

    const [remoteKeys, setRemoteKeys] = useState<string[]>([]);
    const [showRemoteKeys, setShowRemoteKeys] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadKeys();
        }
    }, [isOpen]);

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

    const handleGenerateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        setLoading(true);
        try {
            await api.generateSshKey(newKeyName, newKeyType, newKeyPassphrase || null);
            setShowGenerate(false);
            setNewKeyName('');
            setNewKeyPassphrase('');
            await loadKeys();
        } catch (err) {
            console.error('Failed to generate key:', err);
            alert('Failed to generate key: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleImportKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importKeyName.trim() || !importPrivateKey.trim()) return;

        setLoading(true);
        try {
            await api.importSshKey(importKeyName, importPrivateKey, importPassphrase || null);
            setShowImport(false);
            setImportKeyName('');
            setImportPrivateKey('');
            setImportPassphrase('');
            await loadKeys();
        } catch (err) {
            console.error('Failed to import key:', err);
            alert('Failed to import key: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteKey = async (key: SshKey) => {
        const isConfirmed = await confirm({
            title: 'Delete SSH Key',
            message: `Are you sure you want to delete the key "${key.name}"? This action cannot be undone.`,
            confirmLabel: 'Delete',
            isDestructive: true
        });

        if (isConfirmed) {
            try {
                await api.deleteLocalKey(key.id, key.name);
                await loadKeys();
            } catch (err) {
                console.error('Failed to delete key:', err);
            }
        }
    };

    const handleCopyPublicKey = (key: SshKey) => {
        navigator.clipboard.writeText(key.public_key);
    };

    const handleDeployKey = async (key: SshKey) => {
        if (!deployProfile || !deployUsername) {
            alert('Please select a profile and enter a username');
            return;
        }

        setDeployStatus('Deploying...');
        setLoading(true);

        try {
            const profile = profiles.find(p => p.id === deployProfile);
            if (!profile) {
                throw new Error('Profile not found');
            }

            await api.deployKeyToRemote(profile, key.name, deployUsername);
            setDeployStatus('Key deployed successfully!');
            setTimeout(() => {
                setShowDeploy(false);
                setDeployStatus('');
            }, 1500);
        } catch (err) {
            console.error('Failed to deploy key:', err);
            setDeployStatus('Failed to deploy key: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const loadRemoteKeys = async (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) return;

        setLoading(true);
        try {
            const keys = await api.getRemoteAuthorizedKeys(profile);
            setRemoteKeys(keys);
            setShowRemoteKeys(true);
        } catch (err) {
            console.error('Failed to load remote keys:', err);
            alert('Failed to load remote keys: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveRemoteKey = async (profileId: string, publicKey: string) => {
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) return;

        const isConfirmed = await confirm({
            title: 'Remove SSH Key',
            message: 'Are you sure you want to remove this key from the remote server?',
            confirmLabel: 'Remove',
            isDestructive: true
        });

        if (isConfirmed) {
            try {
                await api.removeRemoteAuthorizedKey(profile, publicKey);
                await loadRemoteKeys(profileId);
            } catch (err) {
                console.error('Failed to remove remote key:', err);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <Key size={20} className="text-[var(--accent-color)]" />
                        <h2 className="text-lg font-semibold text-[var(--text-main)]">SSH Key Manager</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--hover-color)] rounded">
                        <X size={18} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border-color)]">
                    <button
                        onClick={() => setShowGenerate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-color)] text-white rounded-md text-sm hover:opacity-90"
                    >
                        <Plus size={14} /> Generate
                    </button>
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-main)] border border-[var(--border-color)] rounded-md text-sm hover:bg-[var(--hover-color)]"
                    >
                        <Upload size={14} /> Import
                    </button>
                    <button
                        onClick={() => {
                            if (!selectedProfile) {
                                alert('Please select a profile first');
                                return;
                            }
                            loadRemoteKeys(selectedProfile);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-main)] border border-[var(--border-color)] rounded-md text-sm hover:bg-[var(--hover-color)]"
                    >
                        <Server size={14} /> Load Remote Keys
                    </button>
                </div>

                {/* Profile Selector for Remote Keys */}
                <div className="flex items-center gap-2 px-5 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <span className="text-sm text-[var(--text-muted)]">Profile:</span>
                    <select
                        value={selectedProfile}
                        onChange={(e) => setSelectedProfile(e.target.value)}
                        className="flex-1 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-main)]"
                    >
                        <option value="">Select a profile...</option>
                        {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.host})</option>
                        ))}
                    </select>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
                        </div>
                    )}

                    {!loading && keys.length === 0 && (
                        <div className="text-center py-8 text-[var(--text-muted)]">
                            <Key size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No SSH keys found</p>
                            <p className="text-sm">Generate or import a key to get started</p>
                        </div>
                    )}

                    {/* Local Keys */}
                    <div className="space-y-3">
                        {keys.map(key => (
                            <div key={key.id} className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-[var(--text-main)]">{key.name}</span>
                                            <span className="px-2 py-0.5 bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs rounded">
                                                {key.key_type}
                                            </span>
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] mt-1">
                                            Created: {new Date(key.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleCopyPublicKey(key)}
                                            className="p-1.5 hover:bg-[var(--hover-color)] rounded"
                                            title="Copy public key"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedKey(key);
                                                setShowDeploy(true);
                                            }}
                                            className="p-1.5 hover:bg-[var(--hover-color)] rounded"
                                            title="Deploy to server"
                                        >
                                            <Server size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteKey(key)}
                                            className="p-1.5 hover:bg-[var(--hover-color)] rounded text-red-400"
                                            title="Delete key"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 p-2 bg-[var(--bg-primary)] rounded text-xs font-mono text-[var(--text-muted)] truncate">
                                    {key.public_key.substring(0, 80)}...
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Remote Keys */}
                    {showRemoteKeys && remoteKeys.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-[var(--text-main)] mb-3 flex items-center gap-2">
                                <Server size={14} /> Remote Authorized Keys
                            </h3>
                            <div className="space-y-2">
                                {remoteKeys.map((key, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded">
                                        <div className="text-xs font-mono text-[var(--text-muted)] truncate flex-1 mr-2">
                                            {key.substring(0, 80)}...
                                        </div>
                                        <button
                                            onClick={() => handleRemoveRemoteKey(selectedProfile, key)}
                                            className="p-1 hover:bg-[var(--hover-color)] rounded text-red-400"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Generate Modal */}
                {showGenerate && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50" onClick={() => setShowGenerate(false)}>
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4">Generate New SSH Key</h3>
                            <form onSubmit={handleGenerateKey}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Key Name</label>
                                        <input
                                            type="text"
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                            placeholder="my-key"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Key Type</label>
                                        <select
                                            value={newKeyType}
                                            onChange={(e) => setNewKeyType(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                        >
                                            <option value="ed25519">ED25519 (Recommended)</option>
                                            <option value="rsa">RSA (4096 bits)</option>
                                            <option value="ecdsa">ECDSA</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Passphrase (optional)</label>
                                        <div className="relative">
                                            <input
                                                type={showPassphrase ? "text" : "password"}
                                                value={newKeyPassphrase}
                                                onChange={(e) => setNewKeyPassphrase(e.target.value)}
                                                className="w-full px-3 py-2 pr-10 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                                placeholder="Enter passphrase"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassphrase(!showPassphrase)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2"
                                            >
                                                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => setShowGenerate(false)}
                                        className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-[var(--accent-color)] text-white rounded hover:opacity-90 disabled:opacity-50"
                                    >
                                        {loading ? 'Generating...' : 'Generate'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Import Modal */}
                {showImport && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50" onClick={() => setShowImport(false)}>
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4">Import SSH Key</h3>
                            <form onSubmit={handleImportKey}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Key Name</label>
                                        <input
                                            type="text"
                                            value={importKeyName}
                                            onChange={(e) => setImportKeyName(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                            placeholder="imported-key"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Private Key</label>
                                        <textarea
                                            value={importPrivateKey}
                                            onChange={(e) => setImportPrivateKey(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)] font-mono text-xs h-32 resize-none"
                                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Passphrase (if encrypted)</label>
                                        <input
                                            type="password"
                                            value={importPassphrase}
                                            onChange={(e) => setImportPassphrase(e.target.value)}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                            placeholder="Enter passphrase"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => setShowImport(false)}
                                        className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-[var(--accent-color)] text-white rounded hover:opacity-90 disabled:opacity-50"
                                    >
                                        {loading ? 'Importing...' : 'Import'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Deploy Modal */}
                {showDeploy && selectedKey && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50" onClick={() => setShowDeploy(false)}>
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4">Deploy Key to Server</h3>
                            <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded">
                                <div className="text-sm text-[var(--text-main)]">Key: <strong>{selectedKey.name}</strong></div>
                                <div className="text-xs text-[var(--text-muted)] mt-1 truncate">{selectedKey.public_key.substring(0, 50)}...</div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Target Profile</label>
                                    <select
                                        value={deployProfile}
                                        onChange={(e) => setDeployProfile(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                    >
                                        <option value="">Select a profile...</option>
                                        {profiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.host})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Remote Username</label>
                                    <input
                                        type="text"
                                        value={deployUsername}
                                        onChange={(e) => setDeployUsername(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)]"
                                        placeholder="root, ubuntu, etc."
                                    />
                                </div>
                                {deployStatus && (
                                    <div className={`p-2 rounded text-sm ${deployStatus.includes('success') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                        {deployStatus}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 mt-5">
                                <button
                                    onClick={() => setShowDeploy(false)}
                                    className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeployKey(selectedKey)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-[var(--accent-color)] text-white rounded hover:opacity-90 disabled:opacity-50"
                                >
                                    {loading ? 'Deploying...' : 'Deploy'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
