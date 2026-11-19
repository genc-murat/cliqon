import { useRef, useCallback, useEffect, RefObject } from 'react';
import { CommandPredictor } from '../ml/CommandPredictor';
import { storage } from '../lib/storage';
import type { IMarker, Terminal } from '@xterm/xterm';
import { readShellInput, type ShellInputLine } from '../lib/shellHighlight';

const predictorCache: Map<string, CommandPredictor> = new Map();
const refCounts: Map<string, number> = new Map();

function acquirePredictor(profileId: string): CommandPredictor {
    let predictor = predictorCache.get(profileId);
    if (!predictor) {
        predictor = new CommandPredictor();
        predictorCache.set(profileId, predictor);
    }
    const count = refCounts.get(profileId) || 0;
    refCounts.set(profileId, count + 1);
    return predictor;
}

function releasePredictor(profileId: string) {
    const count = refCounts.get(profileId) || 0;
    if (count <= 1) {
        refCounts.delete(profileId);
        predictorCache.delete(profileId);
    } else {
        refCounts.set(profileId, count - 1);
    }
}

import { useSnippets } from './useSnippets';

export function useTerminalHistory(profileId: string, xtermRef: RefObject<Terminal | null>) {
    const lastProfileIdRef = useRef<string>(profileId);
    const predictorRef = useRef<CommandPredictor>(acquirePredictor(profileId));

    useEffect(() => {
        if (lastProfileIdRef.current !== profileId) {
            releasePredictor(lastProfileIdRef.current);
            predictorRef.current = acquirePredictor(profileId);
            lastProfileIdRef.current = profileId;
        }
        return () => {
            releasePredictor(lastProfileIdRef.current);
        };
    }, [profileId]);
    const { snippets } = useSnippets();

    // Exact buffer synchronization state
    const promptStartXRef = useRef<number>(-1);
    const promptStartRef = useRef<IMarker | null>(null);

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

    const getCurrentInput = useCallback((): ShellInputLine[] | null => {
        const term = xtermRef.current;
        const startRow = promptStartRef.current?.line ?? -1;
        const buffer = term?.buffer.active;
        if (!term || !buffer || buffer.type !== 'normal' || startRow < 0) return null;

        const cursorRow = buffer.baseY + buffer.cursorY;
        if (cursorRow < startRow) return null;
        const lines = readShellInput(term, startRow, promptStartXRef.current);
        return lines.some(line => line.row === cursorRow) ? lines : null;
    }, [xtermRef]);

    const extractCurrentCommand = useCallback(() =>
        getCurrentInput()?.map(line => line.text).join('') ?? '', [getCurrentInput]);

    const resetInput = useCallback(() => {
        promptStartRef.current?.dispose();
        promptStartRef.current = null;
        promptStartXRef.current = -1;
    }, []);

    const processKeystroke = useCallback((data: string) => {
        const term = xtermRef.current;
        if (!term || term.buffer.active.type !== 'normal') return;

        // Reset or set prompt start markers
        if (data === '\r' || data === '\n') {
            const cmd = extractCurrentCommand();
            if (cmd.trim().length >= 2) {
                predictorRef.current.learn(cmd.trim());
                scheduleSave();
            }
            resetInput();
            return;
        }

        if (data === '\x03' || data === '\x15') { // Ctrl+C or Ctrl+U
            resetInput();
            return;
        }

        if (!promptStartRef.current || promptStartRef.current.isDisposed) {
            promptStartXRef.current = term.buffer.active.cursorX;
            promptStartRef.current = term.registerMarker() ?? null;
        }
    }, [extractCurrentCommand, resetInput, scheduleSave, xtermRef]);

    const updatePrediction = useCallback((): { ghostText: string | null; activeSuggestion: string | null } => {
        if (promptStartXRef.current === -1) {
            return { ghostText: null, activeSuggestion: null };
        }

        const input = extractCurrentCommand();
        if (input.length < 2) {
            return { ghostText: null, activeSuggestion: null };
        }

        const suggestion = predictorRef.current.getBestSuggestion(input);
        if (suggestion && suggestion.startsWith(input) && suggestion !== input) {
            const remainder = suggestion.slice(input.length);
            return { ghostText: remainder, activeSuggestion: suggestion };
        }

        return { ghostText: null, activeSuggestion: null };
    }, [extractCurrentCommand]);

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
        updatePrediction,
        extractCurrentCommand,
        getCurrentInput,
        resetInput,
        predictor: predictorRef.current,
        isLoaded: isLoadedRef.current,
    };
}
