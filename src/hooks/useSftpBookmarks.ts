import { useState, useCallback, useMemo } from 'react';

interface SftpBookmark {
    path: string;
    host: string;
    label?: string;
    addedAt: number;
}

const STORAGE_KEY = 'cliqon:sftp-bookmarks';

const load = (): SftpBookmark[] => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
        return [];
    }
};

const save = (bms: SftpBookmark[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bms));
};

export const useSftpBookmarks = (host: string) => {
    const [all, setAll] = useState<SftpBookmark[]>(load);

    const bookmarks = useMemo(() => all.filter(b => b.host === host), [all, host]);

    const addBookmark = useCallback((path: string, label?: string) => {
        setAll(prev => {
            // Avoid duplicates for same host+path
            if (prev.some(b => b.host === host && b.path === path)) return prev;
            const next = [...prev, { path, host, label, addedAt: Date.now() }];
            save(next);
            return next;
        });
    }, [host]);

    const removeBookmark = useCallback((path: string) => {
        setAll(prev => {
            const next = prev.filter(b => !(b.host === host && b.path === path));
            save(next);
            return next;
        });
    }, [host]);

    const isBookmarked = useCallback((path: string) => bookmarks.some(b => b.path === path), [bookmarks]);

    return { bookmarks, addBookmark, removeBookmark, isBookmarked };
};
