import { useRef, useCallback, useEffect, RefObject } from 'react';
import { CommandPredictor } from '../ml/CommandPredictor';
import { storage } from '../lib/storage';
import { Terminal } from '@xterm/xterm';

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

export function useTerminalHistory(profileId: string, xtermRef: RefObject<Terminal | null>) {
    const predictorRef = useRef<CommandPredictor>(getOrCreatePredictor(profileId));
    const { snippets } = useSnippets();

    // Exact buffer synchronization state
    const promptStartXRef = useRef<number>(-1);
    const promptStartYRef = useRef<number>(-1);

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

    const extractCurrentCommand = useCallback((): string => {
        const term = xtermRef.current;
        if (!term || promptStartXRef.current === -1 || promptStartYRef.current === -1) {
            return '';
        }

        let cmd = '';
        let currentY = promptStartYRef.current;
        const buffer = term.buffer.active;

        while (currentY < buffer.length) {
            const line = buffer.getLine(currentY);
            if (!line) break;

            const startX = currentY === promptStartYRef.current ? promptStartXRef.current : 0;
            const text = line.translateToString(true, startX);
            cmd += text;

            if (!line.isWrapped) break;
            currentY++;
        }

        return cmd;
    }, [xtermRef]);

    const processKeystroke = useCallback((data: string) => {
        if (isInteractiveRef.current) return;
        const term = xtermRef.current;
        if (!term) return;

        // Reset or set prompt start markers
        if (data === '\r' || data === '\n') {
            const cmd = extractCurrentCommand();
            if (cmd.trim().length >= 2) {
                predictorRef.current.learn(cmd.trim());
                scheduleSave();
            }
            promptStartXRef.current = -1;
            promptStartYRef.current = -1;
            return;
        }

        if (data === '\x03' || data === '\x15') { // Ctrl+C or Ctrl+U
            promptStartXRef.current = -1;
            promptStartYRef.current = -1;
            return;
        }

        if (promptStartXRef.current === -1) {
            promptStartXRef.current = term.buffer.active.cursorX;
            promptStartYRef.current = term.buffer.active.cursorY + term.buffer.active.baseY;
        }
    }, [extractCurrentCommand, scheduleSave, xtermRef]);

    const updatePrediction = useCallback((): { ghostText: string | null; activeSuggestion: string | null } => {
        if (isInteractiveRef.current || promptStartXRef.current === -1) {
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
        processOutput,
        updatePrediction,
        extractCurrentCommand,
        predictor: predictorRef.current,
        isLoaded: isLoadedRef.current,
    };
}
