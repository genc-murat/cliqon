import { useState, useEffect, useCallback } from 'react';
import { SshProfile } from '../types/connection';
import { api } from '../services/api';

export function useConnections() {
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
            await loadProfiles(); // Reload to get fresh state
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

    return {
        profiles,
        isLoading,
        error,
        saveProfile,
        deleteProfile,
        refresh: loadProfiles
    };
}
