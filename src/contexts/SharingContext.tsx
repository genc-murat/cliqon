import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { PeerInfo, PendingShare, SharingStatus } from '../types/sharing';

interface SharingContextType {
    isPanelOpen: boolean;
    status: SharingStatus | null;
    peers: PeerInfo[];
    pendingShares: PendingShare[];
    displayName: string;

    togglePanel: () => void;
    setPanelOpen: (isOpen: boolean) => void;

    toggleSharing: () => Promise<void>;
    saveDisplayName: (name: string) => Promise<void>;
    handleAccept: (shareId: string) => Promise<number>;
    handleReject: (shareId: string) => Promise<void>;
    pingPeer: (ip: string, port: number) => Promise<PeerInfo>;
    refreshStatus: () => Promise<void>;
}

const SharingContext = createContext<SharingContextType | undefined>(undefined);

export const SharingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [status, setStatus] = useState<SharingStatus | null>(null);
    const [peers, setPeers] = useState<PeerInfo[]>([]);
    const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
    const [displayName, setDisplayName] = useState('');

    const pollRef = useRef<number | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const s = await api.getSharingStatus();
            setStatus(s);
            if (s.display_name && !displayName) {
                setDisplayName(s.display_name);
            }
        } catch (err) {
            console.error("Failed to get sharing status", err);
        }
    }, [displayName]);

    // Initial load
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Polling internally
    useEffect(() => {
        if (!status?.active) {
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
    }, [status?.active]);

    const togglePanel = useCallback(() => setIsPanelOpen(p => !p), []);
    const setPanelOpen = useCallback((open: boolean) => setIsPanelOpen(open), []);

    const toggleSharing = useCallback(async () => {
        if (status?.active) {
            const s = await api.stopSharing();
            setStatus(s);
            setPeers([]);
            setPendingShares([]);
        } else {
            const s = await api.startSharing();
            setStatus(s);
        }
    }, [status]);

    const saveDisplayName = useCallback(async (name: string) => {
        if (name.trim()) {
            await api.setDisplayName(name.trim());
            setDisplayName(name.trim());
            await refreshStatus();
        }
    }, [refreshStatus]);

    const handleAccept = useCallback(async (shareId: string) => {
        const count = await api.acceptShare(shareId);
        setPendingShares(prev => prev.filter(s => s.id !== shareId));
        return count;
    }, []);

    const handleReject = useCallback(async (shareId: string) => {
        await api.rejectShare(shareId);
        setPendingShares(prev => prev.filter(s => s.id !== shareId));
    }, []);

    const pingPeer = useCallback(async (ip: string, port: number) => {
        const peer = await api.pingPeer(ip, port);
        setPeers(prev => {
            if (prev.find(p => p.id === peer.id)) return prev;
            return [...prev, peer];
        });
        return peer;
    }, []);

    const value = {
        isPanelOpen,
        status,
        peers,
        pendingShares,
        displayName,
        togglePanel,
        setPanelOpen,
        toggleSharing,
        saveDisplayName,
        handleAccept,
        handleReject,
        pingPeer,
        refreshStatus
    };

    return (
        <SharingContext.Provider value={value}>
            {children}
        </SharingContext.Provider>
    );
};

export const useSharing = () => {
    const context = useContext(SharingContext);
    if (context === undefined) {
        throw new Error('useSharing must be used within a SharingProvider');
    }
    return context;
};
