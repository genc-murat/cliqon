import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Snippet } from '../types/connection';

export function useSnippets() {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSnippets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await invoke<Snippet[]>('get_snippets');
            setSnippets(data || []);
        } catch (err) {
            console.error('Failed to load snippets:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveSnippet = useCallback(async (snippet: Snippet) => {
        setError(null);
        try {
            await invoke('save_snippet', { snippet });
            // Update local state without waiting for full reload
            setSnippets(prev => {
                const idx = prev.findIndex(s => s.id === snippet.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = snippet;
                    return next;
                }
                return [...prev, snippet];
            });
        } catch (err) {
            console.error('Failed to save snippet:', err);
            setError(err instanceof Error ? err.message : String(err));
            throw err;
        }
    }, []);

    const deleteSnippet = useCallback(async (id: string) => {
        setError(null);
        try {
            await invoke('delete_snippet', { id });
            setSnippets(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error('Failed to delete snippet:', err);
            setError(err instanceof Error ? err.message : String(err));
            throw err;
        }
    }, []);

    useEffect(() => {
        loadSnippets();
    }, [loadSnippets]);

    return {
        snippets,
        isLoading,
        error,
        loadSnippets,
        saveSnippet,
        deleteSnippet,
    };
}
