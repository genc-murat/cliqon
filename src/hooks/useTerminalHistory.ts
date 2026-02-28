import { useRef, useCallback, useEffect } from 'react';
import { CommandPredictor } from '../ml/CommandPredictor';
import { storage } from '../lib/storage';

const predictorCache: Map<string, CommandPredictor> = new Map();

function getOrCreatePredictor(profileId: string): CommandPredictor {
    let predictor = predictorCache.get(profileId);
    if (!predictor) {
        predictor = new CommandPredictor();
        predictorCache.set(profileId, predictor);
    }
    return predictor;
}

import { useSnippets } from './useSnippets';

export function useTerminalHistory(profileId: string) {
    const predictorRef = useRef<CommandPredictor>(getOrCreatePredictor(profileId));
    const { snippets } = useSnippets();
    const inputBufferRef = useRef<string>('');
    const isInteractiveRef = useRef<boolean>(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLoadedRef = useRef<boolean>(false);

    useEffect(() => {
        predictorRef.current.setSnippets(snippets.map(s => s.command));
    }, [snippets]);

    useEffect(() => {
        const loadModel = async () => {
            try {
                await storage.initialize();
                const savedModel = await storage.getMlModel(profileId);
                if (savedModel) {
                    predictorRef.current.deserialize(savedModel);
                }
                isLoadedRef.current = true;
            } catch (e) {
                console.warn('Failed to load ML model for profile', profileId, e);
                isLoadedRef.current = true;
            }
        };

        loadModel();
    }, [profileId]);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                const serialized = predictorRef.current.serialize();
                await storage.saveMlModel(profileId, serialized);
            } catch (e) {
                console.warn('Failed to save ML model', e);
            }
        }, 5000);
    }, [profileId]);

    const processOutput = useCallback((data: string) => {
        if (data.includes('\x1b[?1049h') || data.includes('\x1b[?47h')) {
            isInteractiveRef.current = true;
        }
        if (data.includes('\x1b[?1049l') || data.includes('\x1b[?47l')) {
            isInteractiveRef.current = false;
        }
    }, []);

    const processKeystroke = useCallback((data: string): { consumed: boolean; suggestion: string | null } => {
        if (isInteractiveRef.current) {
            return { consumed: false, suggestion: null };
        }

        const charCode = data.charCodeAt(0);

        if (data === '\r' || data === '\n') {
            const cmd = inputBufferRef.current.trim();
            if (cmd.length >= 2) {
                predictorRef.current.learn(cmd);
                scheduleSave();
            }
            inputBufferRef.current = '';
            return { consumed: false, suggestion: null };
        }

        if (data === '\x03') {
            inputBufferRef.current = '';
            return { consumed: false, suggestion: null };
        }

        if (data === '\x15') {
            inputBufferRef.current = '';
            return { consumed: false, suggestion: null };
        }

        if (charCode === 127 || data === '\b') {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            const suggestion = inputBufferRef.current.length >= 2
                ? predictorRef.current.getBestSuggestion(inputBufferRef.current)
                : null;
            return { consumed: false, suggestion };
        }

        if (data.startsWith('\x1b')) {
            return { consumed: false, suggestion: null };
        }

        if (data === '\t') {
            return { consumed: false, suggestion: null };
        }

        if (charCode >= 32 && charCode < 127) {
            inputBufferRef.current += data;
            const suggestion = inputBufferRef.current.length >= 2
                ? predictorRef.current.getBestSuggestion(inputBufferRef.current)
                : null;
            return { consumed: false, suggestion };
        }

        return { consumed: false, suggestion: null };
    }, [scheduleSave]);

    const getCurrentInput = useCallback((): string => {
        return inputBufferRef.current;
    }, []);

    const clearBuffer = useCallback(() => {
        inputBufferRef.current = '';
    }, []);

    const getSuggestionRemainder = useCallback((suggestion: string): string => {
        const current = inputBufferRef.current;
        if (suggestion.startsWith(current)) {
            return suggestion.slice(current.length);
        }
        return '';
    }, []);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            try {
                const serialized = predictorRef.current.serialize();
                storage.saveMlModel(profileId, serialized);
            } catch { /* ignore */ }
        };
    }, [profileId]);

    return {
        processKeystroke,
        processOutput,
        getCurrentInput,
        clearBuffer,
        getSuggestionRemainder,
        predictor: predictorRef.current,
        isLoaded: isLoadedRef.current,
    };
}
