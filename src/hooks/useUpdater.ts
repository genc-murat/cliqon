import { useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'up-to-date' | 'error';

export const useUpdater = () => {
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [manifest, setManifest] = useState<any>(null);

    const checkForUpdates = useCallback(async (silent = false) => {
        try {
            setStatus('checking');
            setError(null);

            const update = await check();

            if (update) {
                setManifest(update);
                setStatus('available');
                return update;
            } else {
                setStatus('up-to-date');
                return null;
            }
        } catch (e) {
            console.error('Update check failed:', e);
            if (!silent) {
                setError(e instanceof Error ? e.message : String(e));
            }
            setStatus('error');
            return null;
        }
    }, []);

    const installUpdate = useCallback(async () => {
        if (!manifest) return;

        try {
            setStatus('downloading');

            // In Tauri v2, downloadAndInstall is often combined or separate.
            // Using update.downloadAndInstall() from the check() result.
            await manifest.downloadAndInstall();

            // Relaunch the app to apply the update
            await relaunch();
        } catch (e) {
            console.error('Update installation failed:', e);
            setError(e instanceof Error ? e.message : String(e));
            setStatus('error');
        }
    }, [manifest]);

    return {
        status,
        error,
        manifest,
        checkForUpdates,
        installUpdate
    };
};
