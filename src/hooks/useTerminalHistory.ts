import { useRef, useCallback, useEffect } from 'react';
import { CommandPredictor } from '../ml/CommandPredictor';

const STORAGE_PREFIX = 'cliqon-ml-model-';

// Singleton predictor instances per profile (shared across sessions of same host)
const predictorCache: Map<string, CommandPredictor> = new Map();

function getOrCreatePredictor(profileId: string): CommandPredictor {
    let predictor = predictorCache.get(profileId);
    if (!predictor) {
        predictor = new CommandPredictor();
        // Restore saved model
        try {
            const saved = localStorage.getItem(STORAGE_PREFIX + profileId);
            if (saved) {
                predictor.deserialize(saved);
            }
        } catch (e) {
            console.warn('Failed to load ML model for profile', profileId, e);
        }
        predictorCache.set(profileId, predictor);
    }
    return predictor;
}

/**
 * Hook that tracks terminal input and provides ML-powered autocomplete suggestions.
 * Intercepts keystrokes to build the current input buffer and uses CommandPredictor
 * for intelligent suggestions.
 */
export function useTerminalHistory(profileId: string) {
    const predictorRef = useRef<CommandPredictor>(getOrCreatePredictor(profileId));
    const inputBufferRef = useRef<string>('');
    const isInteractiveRef = useRef<boolean>(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced save to localStorage
    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            try {
                const serialized = predictorRef.current.serialize();
                localStorage.setItem(STORAGE_PREFIX + profileId, serialized);
            } catch (e) {
                console.warn('Failed to save ML model', e);
            }
        }, 5000); // Save 5 seconds after last change
    }, [profileId]);

    // Process raw terminal output to detect interactive programs
    const processOutput = useCallback((data: string) => {
        // Detect if we entered an interactive program (vim, htop, nano, etc.)
        // These programs typically use alternate screen buffer: ESC[?1049h or ESC[?47h
        if (data.includes('\x1b[?1049h') || data.includes('\x1b[?47h')) {
            isInteractiveRef.current = true;
        }
        // Detect exit from alternate screen buffer
        if (data.includes('\x1b[?1049l') || data.includes('\x1b[?47l')) {
            isInteractiveRef.current = false;
        }
    }, []);

    /**
     * Process a keystroke from the user.
     * Returns true if the key was consumed (suggestion accepted), false otherwise.
     */
    const processKeystroke = useCallback((data: string): { consumed: boolean; suggestion: string | null } => {
        // Don't provide suggestions in interactive programs
        if (isInteractiveRef.current) {
            return { consumed: false, suggestion: null };
        }

        const charCode = data.charCodeAt(0);

        // Enter: learn command and reset buffer
        if (data === '\r' || data === '\n') {
            const cmd = inputBufferRef.current.trim();
            if (cmd.length >= 2) {
                predictorRef.current.learn(cmd);
                scheduleSave();
            }
            inputBufferRef.current = '';
            return { consumed: false, suggestion: null };
        }

        // Ctrl+C: clear buffer
        if (data === '\x03') {
            inputBufferRef.current = '';
            return { consumed: false, suggestion: null };
        }

        // Ctrl+U: clear line
        if (data === '\x15') {
            inputBufferRef.current = '';
            return { consumed: false, suggestion: null };
        }

        // Backspace (127 or \b)
        if (charCode === 127 || data === '\b') {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            const suggestion = inputBufferRef.current.length >= 2
                ? predictorRef.current.getBestSuggestion(inputBufferRef.current)
                : null;
            return { consumed: false, suggestion };
        }

        // Escape sequences (arrows, function keys, etc.) — don't add to buffer
        if (data.startsWith('\x1b')) {
            return { consumed: false, suggestion: null };
        }

        // Tab: we will handle this in TerminalViewer for suggestion acceptance
        if (data === '\t') {
            return { consumed: false, suggestion: null };
        }

        // Regular printable character
        if (charCode >= 32 && charCode < 127) {
            inputBufferRef.current += data;
            const suggestion = inputBufferRef.current.length >= 2
                ? predictorRef.current.getBestSuggestion(inputBufferRef.current)
                : null;
            return { consumed: false, suggestion };
        }

        // Anything else (multi-byte, etc.)
        return { consumed: false, suggestion: null };
    }, [scheduleSave]);

    /**
     * Get the current input buffer content.
     */
    const getCurrentInput = useCallback((): string => {
        return inputBufferRef.current;
    }, []);

    /**
     * Clear the input buffer (e.g., on disconnect).
     */
    const clearBuffer = useCallback(() => {
        inputBufferRef.current = '';
    }, []);

    /**
     * Get the remaining text of a suggestion to type.
     */
    const getSuggestionRemainder = useCallback((suggestion: string): string => {
        const current = inputBufferRef.current;
        if (suggestion.startsWith(current)) {
            return suggestion.slice(current.length);
        }
        return '';
    }, []);

    // Cleanup save timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            // Final save on unmount
            try {
                const serialized = predictorRef.current.serialize();
                localStorage.setItem(STORAGE_PREFIX + profileId, serialized);
            } catch (_) { /* ignore */ }
        };
    }, [profileId]);

    return {
        processKeystroke,
        processOutput,
        getCurrentInput,
        clearBuffer,
        getSuggestionRemainder,
        predictor: predictorRef.current,
    };
}
