import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Users, Wifi, WifiOff, Send, Check, X,
    Monitor, Shield, RefreshCw, Inbox, User, Radio, Plus
} from 'lucide-react';
import { api } from '../../services/api';
import { SshProfile } from '../../types/connection';
import { PeerInfo, PendingShare, SharingStatus } from '../../types/sharing';

interface SharingPanelProps {
    isOpen: boolean;
    onClose: () => void;
    profiles: SshProfile[];
    onProfilesChanged: () => void;
}

export const SharingPanel: React.FC<SharingPanelProps> = ({
    isOpen, onClose, profiles, onProfilesChanged
}) => {
    const [status, setStatus] = useState<SharingStatus | null>(null);
    const [peers, setPeers] = useState<PeerInfo[]>([]);
    const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
    const [displayName, setDisplayName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [selectedPeer, setSelectedPeer] = useState<PeerInfo | null>(null);
    const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);
    const [manualIp, setManualIp] = useState('');
    const [manualPort, setManualPort] = useState('19875');
    const [isPinging, setIsPinging] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const pollRef = useRef<number | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Load initial status
    useEffect(() => {
        if (isOpen) {
            api.getSharingStatus().then((s) => {
                setStatus(s);
                setDisplayName(s.display_name);
            }).catch(() => { });
        }
    }, [isOpen]);

    // Polling for peers and pending shares
    useEffect(() => {
        if (!isOpen || !status?.active) {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        const poll = () => {
            api.getDiscoveredPeers().then(setPeers).catch(() => { });
            api.getPendingShares().then(setPendingShares).catch(() => { });
        };
        poll();
        pollRef.current = window.setInterval(poll, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isOpen, status?.active]);

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const toggleSharing = async () => {
        try {
            if (status?.active) {
                const s = await api.stopSharing();
                setStatus(s);
                setPeers([]);
            } else {
                const s = await api.startSharing();
                setStatus(s);
            }
        } catch (err: any) {
            showToast(err.toString(), 'error');
        }
    };

    const saveName = async () => {
        if (displayName.trim()) {
            await api.setDisplayName(displayName.trim());
            setIsEditingName(false);
            const s = await api.getSharingStatus();
            setStatus(s);
        }
    };

    const handleShare = async () => {
        if (!selectedPeer || selectedProfileIds.size === 0) return;
        setIsSending(true);
        try {
            const msg = await api.shareProfiles(selectedPeer.id, Array.from(selectedProfileIds));
            showToast(msg, 'success');
            setSelectedPeer(null);
            setSelectedProfileIds(new Set());
        } catch (err: any) {
            showToast(err.toString(), 'error');
        } finally {
            setIsSending(false);
        }
    };

    const handleAccept = async (shareId: string) => {
        try {
            const count = await api.acceptShare(shareId);
            showToast(`${count} profile(s) imported successfully`, 'success');
            onProfilesChanged();
            setPendingShares(prev => prev.filter(s => s.id !== shareId));
        } catch (err: any) {
            showToast(err.toString(), 'error');
        }
    };

    const handleReject = async (shareId: string) => {
        try {
            await api.rejectShare(shareId);
            setPendingShares(prev => prev.filter(s => s.id !== shareId));
        } catch (err: any) {
            showToast(err.toString(), 'error');
        }
    };

    const handleManualConnect = async () => {
        if (!manualIp.trim()) return;
        setIsPinging(true);
        try {
            const port = parseInt(manualPort) || 19875;
            const peer = await api.pingPeer(manualIp.trim(), port);
            setPeers(prev => {
                if (prev.find(p => p.id === peer.id)) return prev;
                return [...prev, peer];
            });
            setSelectedPeer(peer);
            showToast(`Found peer: ${peer.display_name}`, 'success');
            setManualIp('');
        } catch (err: any) {
            showToast(`Could not find peer at ${manualIp}:${manualPort}`, 'error');
        } finally {
            setIsPinging(false);
        }
    };

    const toggleProfileSelect = (id: string) => {
        setSelectedProfileIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllProfiles = () => {
        if (selectedProfileIds.size === profiles.length) {
            setSelectedProfileIds(new Set());
        } else {
            setSelectedProfileIds(new Set(profiles.map(p => p.id)));
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-[90vw] bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-2xl flex flex-col animate-slide-in">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-color)] shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                <Users size={16} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-[var(--text-main)]">Network Sharing</h2>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    {status?.active ? `${status.local_ip}:${status.http_port}` : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Toggle + Name */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleSharing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${status?.active
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-[var(--hover-color)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)]'
                                }`}
                        >
                            {status?.active
                                ? <><Wifi size={12} /> Active</>
                                : <><WifiOff size={12} /> Start</>
                            }
                        </button>

                        {isEditingName ? (
                            <div className="flex items-center gap-1 flex-1">
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                    className="flex-1 px-2 py-1 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)]"
                                    autoFocus
                                />
                                <button onClick={saveName} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
                                    <Check size={12} />
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="p-1 text-[var(--text-muted)] hover:bg-[var(--hover-color)] rounded">
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setIsEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
                                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors flex-1 truncate"
                                title="Change display name"
                            >
                                <User size={11} />
                                <span className="truncate">{status?.display_name || displayName}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {!status?.active ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-16 h-16 rounded-full bg-[var(--hover-color)] flex items-center justify-center mb-4">
                                <Radio size={28} className="text-[var(--text-muted)]" />
                            </div>
                            <h3 className="text-sm font-semibold text-[var(--text-main)] mb-2">Sharing Disabled</h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                Enable sharing to discover other Cliqon users on the same network and share connection profiles.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* ─── Incoming Shares ─────────────────── */}
                            {pendingShares.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Inbox size={12} className="text-amber-400" />
                                        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                                            Incoming Shares ({pendingShares.length})
                                        </h3>
                                    </div>
                                    <div className="space-y-2">
                                        {pendingShares.map(share => (
                                            <div key={share.id} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <span className="text-xs font-semibold text-[var(--text-main)]">
                                                            {share.from_name}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--text-muted)] ml-1.5">
                                                            ({share.from_ip})
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-[var(--text-muted)]">
                                                        {share.profiles.length} profil
                                                    </span>
                                                </div>
                                                <div className="space-y-1 mb-2">
                                                    {share.profiles.map(sp => (
                                                        <div key={sp.id} className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                                            <Shield size={10} className="text-[var(--accent-color)] shrink-0" />
                                                            <span className="truncate">{sp.name}</span>
                                                            <span className="text-[10px] opacity-60">{sp.username}@{sp.host}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleAccept(share.id)}
                                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                                                    >
                                                        <Check size={12} /> Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(share.id)}
                                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-[var(--hover-color)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-red-400 hover:border-red-500/30 transition-colors"
                                                    >
                                                        <X size={12} /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ─── Discovered Peers ───────────────── */}
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Monitor size={12} className="text-[var(--accent-color)]" />
                                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                        Peers on Network ({peers.length})
                                    </h3>
                                </div>

                                {peers.length === 0 ? (
                                    <div className="py-6 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                                        <RefreshCw size={20} className="mx-auto mb-2 text-[var(--text-muted)] animate-spin opacity-40" />
                                        <p className="text-xs text-[var(--text-muted)]">
                                            Searching for peers...
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {peers.map(peer => (
                                            <button
                                                key={peer.id}
                                                onClick={() => {
                                                    setSelectedPeer(selectedPeer?.id === peer.id ? null : peer);
                                                    setSelectedProfileIds(new Set());
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${selectedPeer?.id === peer.id
                                                    ? 'bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30'
                                                    : 'bg-[var(--hover-color)]/50 border border-transparent hover:border-[var(--border-color)]'
                                                    }`}
                                            >
                                                <div className="relative">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center">
                                                        <User size={14} className="text-violet-400" />
                                                    </div>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--bg-primary)]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-semibold text-[var(--text-main)] block truncate">
                                                        {peer.display_name}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                                        {peer.ip}
                                                    </span>
                                                </div>
                                                <Send size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ─── Manual Connect ─────────────────── */}
                            <div className="border-t border-[var(--border-color)] pt-4">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Send size={12} className="text-[var(--text-muted)]" />
                                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                        Manual Connection
                                    </h3>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 flex bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden focus-within:border-[var(--accent-color)] transition-colors">
                                        <input
                                            type="text"
                                            placeholder="IP Address"
                                            value={manualIp}
                                            onChange={(e) => setManualIp(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                                            className="min-w-0 flex-1 px-3 py-2 text-xs bg-transparent text-[var(--text-main)] focus:outline-none"
                                        />
                                        <div className="w-px bg-[var(--border-color)] my-1.5" />
                                        <input
                                            type="text"
                                            placeholder="Port"
                                            value={manualPort}
                                            onChange={(e) => setManualPort(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                                            className="w-16 px-2 py-2 text-xs bg-transparent text-[var(--text-muted)] focus:outline-none text-center"
                                        />
                                    </div>
                                    <button
                                        onClick={handleManualConnect}
                                        disabled={!manualIp || isPinging}
                                        className="px-3 py-2 rounded-lg bg-[var(--hover-color)] text-[var(--text-main)] hover:bg-[var(--accent-color)] hover:text-white transition-all disabled:opacity-40"
                                        title="Connect manually"
                                    >
                                        {isPinging ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mt-2 italic px-1">
                                    Use this if auto-discovery fails on VPN or complex networks.
                                </p>
                            </div>

                            {/* ─── Profile selection for sharing ──── */}
                            {selectedPeer && (
                                <div className="border-t border-[var(--border-color)] pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                            Profiles to Share
                                        </h3>
                                        <button
                                            onClick={selectAllProfiles}
                                            className="text-[10px] text-[var(--accent-color)] hover:underline"
                                        >
                                            {selectedProfileIds.size === profiles.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>

                                    <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 mb-3">
                                        {profiles.map(p => (
                                            <label
                                                key={p.id}
                                                className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${selectedProfileIds.has(p.id)
                                                    ? 'bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30'
                                                    : 'hover:bg-[var(--hover-color)] border border-transparent'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProfileIds.has(p.id)}
                                                    onChange={() => toggleProfileSelect(p.id)}
                                                    className="sr-only"
                                                />
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${selectedProfileIds.has(p.id)
                                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                                                    : 'border-[var(--border-color)]'
                                                    }`}>
                                                    {selectedProfileIds.has(p.id) && <Check size={10} className="text-white" />}
                                                </div>
                                                <Shield size={12} style={p.color ? { color: p.color } : {}} className="text-[var(--accent-color)] shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs text-[var(--text-main)] block truncate">{p.name}</span>
                                                    <span className="text-[10px] text-[var(--text-muted)] font-mono truncate block">
                                                        {p.username}@{p.host}:{p.port}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleShare}
                                        disabled={selectedProfileIds.size === 0 || isSending}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20"
                                    >
                                        {isSending ? (
                                            <><RefreshCw size={13} className="animate-spin" /> Sending...</>
                                        ) : (
                                            <><Send size={13} /> Share with {selectedPeer.display_name} ({selectedProfileIds.size})</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`absolute bottom-4 left-4 right-4 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl z-50 transition-all ${toast.type === 'success'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-red-500/90 text-white'
                        }`}>
                        {toast.message}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in {
                    animation: slide-in 0.25s ease-out;
                }
            `}</style>
        </>
    );
};
