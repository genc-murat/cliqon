import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SshProfile } from '../types/connection';
import { api } from '../services/api';

interface ConnectionsContextType {
    profiles: SshProfile[];
    isLoading: boolean;
    error: string | null;
    saveProfile: (profile: SshProfile, secret?: string | null) => Promise<void>;
    deleteProfile: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
    recordUsage: (id: string) => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export const ConnectionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [profiles, setProfiles] = useState<SshProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProfiles = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.getProfiles();
            setProfiles(data);
        } catch (err: any) {
            console.error("Failed to load profiles:", err);
            setError(err.toString());
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    const saveProfile = async (profile: SshProfile, secret: string | null = null) => {
        try {
            await api.saveProfile(profile, secret);
            await loadProfiles();
        } catch (err: any) {
            console.error("Failed to save profile:", err);
            throw err;
        }
    };

    const deleteProfile = async (id: string) => {
        try {
            await api.deleteProfile(id);
            await loadProfiles();
        } catch (err: any) {
            console.error("Failed to delete profile:", err);
            throw err;
        }
    };

    const recordUsage = async (id: string) => {
        try {
            await api.recordUsage(id);
            await loadProfiles();
        } catch (err: any) {
            console.error("Failed to record usage:", err);
        }
    };

    const value = {
        profiles,
        isLoading,
        error,
        saveProfile,
        deleteProfile,
        refresh: loadProfiles,
        recordUsage
    };

    return (
        <ConnectionsContext.Provider value={value}>
            {children}
        </ConnectionsContext.Provider>
    );
};

export const useConnectionsContext = () => {
    const context = useContext(ConnectionsContext);
    if (context === undefined) {
        throw new Error('useConnectionsContext must be used within a ConnectionsProvider');
    }
    return context;
};
