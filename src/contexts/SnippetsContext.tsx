import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Snippet } from '../types/connection';

interface SnippetsContextType {
    snippets: Snippet[];
    isLoading: boolean;
    error: string | null;
    loadSnippets: () => Promise<void>;
    saveSnippet: (snippet: Snippet) => Promise<void>;
    deleteSnippet: (id: string) => Promise<void>;
}

const SnippetsContext = createContext<SnippetsContextType | undefined>(undefined);

export const SnippetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

    return (
        <SnippetsContext.Provider value={{
            snippets,
            isLoading,
            error,
            loadSnippets,
            saveSnippet,
            deleteSnippet
        }}>
            {children}
        </SnippetsContext.Provider>
    );
};

export const useSnippetsContext = () => {
    const context = useContext(SnippetsContext);
    if (context === undefined) {
        throw new Error('useSnippetsContext must be used within a SnippetsProvider');
    }
    return context;
};
