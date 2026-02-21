import React, { useState, useEffect } from 'react';
import { Shield, Key, FilePlus, Save, X, Activity, Star } from 'lucide-react';
import { AuthMethod, SshProfile } from '../../types/connection';
import { invoke } from '@tauri-apps/api/core';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (profile: SshProfile, secret: string | null) => Promise<void>;
    existingProfile?: SshProfile | null;
    existingGroups?: string[];
}

const defaultProfile: SshProfile = {
    id: '',
    name: '',
    host: '',
    port: 22,
    username: '',
    auth_method: 'Password',
    category: '',
    private_key_path: undefined,
    is_favorite: false,
    color: ''
};

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onSave, existingProfile, existingGroups = [] }) => {
    const [profile, setProfile] = useState<SshProfile>(defaultProfile);
    const [secret, setSecret] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testMessage, setTestMessage] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setProfile(existingProfile || { ...defaultProfile, id: crypto.randomUUID() });
            setSecret('');
            setTestStatus('idle');
            setTestMessage('');
        }
    }, [isOpen, existingProfile]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(profile, secret || null);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestMessage('');
        try {
            await invoke('test_ssh_connection', {
                profile,
                providedSecret: secret || null
            });
            setTestStatus('success');
            setTestMessage('Connection successful!');
            setTimeout(() => setTestStatus('idle'), 3000);
        } catch (err: any) {
            setTestStatus('error');
            setTestMessage(typeof err === 'string' ? err : err.message || 'Connection failed');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg w-full max-w-md shadow-2xl p-6 transition-colors duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-[var(--text-main)] flex items-center gap-2">
                        {existingProfile ? <Shield size={20} /> : <FilePlus size={20} />}
                        {existingProfile ? 'Edit Profile' : 'New Connection'}
                    </h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Name</label>
                            <input
                                required
                                value={profile.name}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                placeholder="My Server"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Group <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                            <input
                                list="group-suggestions"
                                value={profile.category ?? ''}
                                onChange={e => setProfile({ ...profile, category: e.target.value || null })}
                                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                placeholder="e.g. Production, Staging, Dev…"
                            />
                            {existingGroups.length > 0 && (
                                <datalist id="group-suggestions">
                                    {existingGroups.map(g => <option key={g} value={g} />)}
                                </datalist>
                            )}
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Host/IP</label>
                            <input
                                required
                                value={profile.host}
                                onChange={e => setProfile({ ...profile, host: e.target.value })}
                                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                placeholder="192.168.1.1"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Port</label>
                            <input
                                required type="number"
                                value={profile.port}
                                onChange={e => setProfile({ ...profile, port: parseInt(e.target.value) || 22 })}
                                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Username</label>
                            <input
                                required
                                value={profile.username}
                                onChange={e => setProfile({ ...profile, username: e.target.value })}
                                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                placeholder="root"
                            />
                        </div>

                        <div className="col-span-1 flex items-center gap-2 mt-6">
                            <input
                                type="checkbox"
                                id="is_favorite"
                                checked={profile.is_favorite || false}
                                onChange={e => setProfile({ ...profile, is_favorite: e.target.checked })}
                                className="w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-sidebar)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
                            />
                            <label htmlFor="is_favorite" className="text-sm font-medium text-[var(--text-main)] flex items-center gap-1 cursor-pointer">
                                <Star size={14} className={profile.is_favorite ? "fill-[var(--accent-color)] text-[var(--accent-color)]" : "text-[var(--text-muted)]"} />
                                Favorite
                            </label>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Color Accent</label>
                            <div className="flex gap-2">
                                {['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'].map((c, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setProfile({ ...profile, color: c })}
                                        className={`w-6 h-6 rounded-full border-2 ${profile.color === c ? 'border-[var(--accent-color)] scale-110 shadow-sm' : 'border-transparent hover:scale-110'} transition-all`}
                                        style={{ backgroundColor: c || 'var(--bg-sidebar)' }}
                                        title={c ? c : 'None'}
                                    >
                                        {!c && <X size={12} className="mx-auto text-[var(--text-muted)]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Authentication Method</label>
                            <select
                                value={profile.auth_method}
                                onChange={e => setProfile({ ...profile, auth_method: e.target.value as AuthMethod })}
                                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                            >
                                <option value="Password">Password</option>
                                <option value="PrivateKey">Private Key</option>
                                <option value="Agent">SSH Agent</option>
                            </select>
                        </div>

                        {profile.auth_method === 'Password' && (
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Password</label>
                                <input
                                    type="password"
                                    value={secret}
                                    onChange={e => setSecret(e.target.value)}
                                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                    placeholder={existingProfile ? "Leave blank to keep current" : "Secure password"}
                                />
                                <p className="text-[10px] text-[var(--text-muted)] mt-1 ml-1 flex items-center gap-1">
                                    <Key size={10} /> Saved securely with platform native keychain.
                                </p>
                            </div>
                        )}

                        {profile.auth_method === 'PrivateKey' && (
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Private Key Path</label>
                                <input
                                    value={profile.private_key_path || ''}
                                    onChange={e => setProfile({ ...profile, private_key_path: e.target.value })}
                                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                    placeholder="/home/user/.ssh/id_rsa"
                                />
                                <label className="block text-xs font-medium text-[var(--text-muted)] mt-3 mb-1">Key Passphrase</label>
                                <input
                                    type="password"
                                    value={secret}
                                    onChange={e => setSecret(e.target.value)}
                                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                    placeholder="Passphrase for the key (if any)"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)] mt-6">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={loading || testStatus === 'testing' || !profile.host || !profile.username}
                                className="px-4 py-2 bg-[var(--bg-sidebar)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                            >
                                <Activity size={16} />
                                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                            </button>
                            {testStatus === 'success' && <span className="text-xs text-green-500">{testMessage}</span>}
                            {testStatus === 'error' && <span className="text-xs text-red-500 max-w-xs truncate" title={testMessage}>{testMessage}</span>}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-[var(--accent-color)] hover:opacity-90 text-white text-sm font-medium rounded-md transition-opacity flex items-center gap-2"
                            >
                                <Save size={16} />
                                {loading ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
