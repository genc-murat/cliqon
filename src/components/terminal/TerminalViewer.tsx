import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { useTerminalHistory } from '../../hooks/useTerminalHistory';
import { FileBrowser } from './FileBrowser';
import { SnippetManager } from './SnippetManager';
import { TerminalSearchBar } from './TerminalSearchBar';
import { TerminalHistorySearch } from './TerminalHistorySearch';
// Make sure to import xterm styles
import '@xterm/xterm/css/xterm.css';

interface TerminalViewerProps {
    profile: SshProfile;
    sessionId: string;
    isActive: boolean;
    /** When true, only render the terminal — no FileBrowser or SnippetManager */
    paneMode?: boolean;
}

export const TerminalViewer: React.FC<TerminalViewerProps> = ({ profile, sessionId, isActive, paneMode = false }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const unlistenRxRef = useRef<UnlistenFn | null>(null);
    const unlistenCloseRef = useRef<UnlistenFn | null>(null);
    const [connected, setConnected] = useState(false);
    const connectedRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const { theme, terminalTheme, terminalFont, terminalCursorStyle } = useTheme();

    // ML-powered autocomplete
    const { processKeystroke, processOutput, getSuggestionRemainder, predictor } = useTerminalHistory(profile.id);
    const [ghostText, setGhostText] = useState<string | null>(null);
    const ghostRef = useRef<HTMLDivElement>(null);
    const activeSuggestionRef = useRef<string | null>(null);

    // Advanced terminal features
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [showHistorySearch, setShowHistorySearch] = useState(false);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const [lineNumberData, setLineNumberData] = useState<{ start: number; count: number }>({ start: 1, count: 0 });

    const getXtermTheme = useCallback(() => {
        if (terminalTheme.id === 'appTheme') {
            const isLight = theme.type === 'light';
            return {
                background: theme.colors.bgPrimary,
                foreground: theme.colors.textMain,
                cursor: theme.colors.accent,
                selectionBackground: theme.colors.hover,
                ...terminalTheme.colors,
                // Override specific ANSI colors for better contrast in light mode if needed
                ...(isLight ? {
                    black: '#000000',
                    white: '#333333',
                    brightWhite: '#000000',
                    yellow: '#859900', // Solarized-style yellow/green for visibility
                    brightYellow: '#b58900',
                } : {})
            };
        }
        return terminalTheme.colors;
    }, [theme, terminalTheme]);

    useEffect(() => {
        connectedRef.current = connected;
    }, [connected]);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: terminalCursorStyle,
            fontFamily: terminalFont.fontFamily,
            fontSize: terminalFont.fontSize,
            lineHeight: terminalFont.lineHeight,
            theme: getXtermTheme()
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        // Load search addon
        const searchAddon = new SearchAddon();
        term.loadAddon(searchAddon);
        searchAddonRef.current = searchAddon;

        // Load web links addon — clickable URLs
        const webLinksAddon = new WebLinksAddon((_event, uri) => {
            window.open(uri, '_blank');
        });
        term.loadAddon(webLinksAddon);

        // Load clipboard addon
        try {
            const clipboardAddon = new ClipboardAddon();
            term.loadAddon(clipboardAddon);
        } catch (e) {
            console.warn('Clipboard addon could not be loaded', e);
        }

        term.open(terminalRef.current);

        try {
            const webglAddon = new WebglAddon();
            webglAddon.onContextLoss(() => webglAddon.dispose());
            term.loadAddon(webglAddon);
        } catch (e) {
            console.warn('WebGL addon could not be loaded, falling back to canvas', e);
        }

        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Cleanup
        return () => {
            term.dispose();
            if (unlistenRxRef.current) unlistenRxRef.current();
            if (unlistenCloseRef.current) unlistenCloseRef.current();
            api.closePty(sessionId).catch(console.error);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Handle theme changes
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getXtermTheme();
        }
    }, [getXtermTheme]);

    // Handle font changes
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.fontFamily = terminalFont.fontFamily;
            xtermRef.current.options.fontSize = terminalFont.fontSize;
            xtermRef.current.options.lineHeight = terminalFont.lineHeight;
            fitAddonRef.current?.fit();
        }
    }, [terminalFont]);

    // Handle cursor style changes
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.cursorStyle = terminalCursorStyle;
        }
    }, [terminalCursorStyle]);

    // Handle connection and events
    useEffect(() => {
        let isMounted = true;

        const setupConnection = async () => {
            if (!xtermRef.current) return;
            const term = xtermRef.current;

            try {
                term.writeln(`\x1b[36mConnecting to ${profile.username}@${profile.host}:${profile.port}...\x1b[0m`);

                // Start listening to events before connecting
                unlistenRxRef.current = await listen<number[]>(`ssh_data_rx_${sessionId}`, (event) => {
                    if (xtermRef.current) {
                        const data = new Uint8Array(event.payload);
                        xtermRef.current.write(data);
                        // Feed output to ML engine for interactive program detection
                        const decoded = new TextDecoder().decode(data);
                        processOutput(decoded);
                    }
                });

                unlistenCloseRef.current = await listen(`ssh_close_${sessionId}`, () => {
                    if (xtermRef.current) {
                        xtermRef.current.writeln('\r\n\x1b[31mConnection closed by remote host.\x1b[0m');
                    }
                    setConnected(false);
                });

                // Connect via API
                await api.connectSsh(profile, sessionId);

                if (isMounted) {
                    setConnected(true);
                    term.writeln(`\r\x1b[32mConnected successfully.\x1b[0m\r\n`);

                    // Trigger initial resize sync
                    if (fitAddonRef.current) {
                        const dims = fitAddonRef.current.proposeDimensions();
                        if (dims) {
                            api.resizePty(sessionId, dims.cols, dims.rows).catch(console.error);
                        }
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.toString());
                    term.writeln(`\r\n\x1b[31mError: ${err.toString()}\x1b[0m`);
                }
            }
        };

        setupConnection();

        // Handle user input with ML autocomplete
        const onDataDisposable = xtermRef.current?.onData((data) => {
            if (!connectedRef.current) return;

            const encoder = new TextEncoder();

            // Tab or Right Arrow: accept suggestion if one is active
            if ((data === '\t' || data === '\x1b[C') && activeSuggestionRef.current) {
                const remainder = activeSuggestionRef.current;
                if (remainder) {
                    const bytes = Array.from(encoder.encode(remainder));
                    api.writeToPty(sessionId, bytes).catch(console.error);
                    activeSuggestionRef.current = null;
                    setGhostText(null);
                    return; // Consume the keystroke
                }
            }

            // Escape: dismiss suggestion
            if (data === '\x1b' && activeSuggestionRef.current) {
                activeSuggestionRef.current = null;
                setGhostText(null);
                // Still send Escape to terminal
            }

            // Process keystroke through ML engine
            const { suggestion } = processKeystroke(data);

            if (suggestion) {
                const currentInput = data === '\r' ? '' : undefined;
                if (currentInput !== '') {
                    const remainder = getSuggestionRemainder(suggestion);
                    if (remainder) {
                        activeSuggestionRef.current = remainder;
                        setGhostText(remainder);
                    } else {
                        activeSuggestionRef.current = null;
                        setGhostText(null);
                    }
                }
            } else {
                activeSuggestionRef.current = null;
                setGhostText(null);
            }

            // Send the original keystroke to the PTY
            const bytes = Array.from(encoder.encode(data));
            api.writeToPty(sessionId, bytes).catch(console.error);
        });

        // Handle terminal resize
        const onResizeDisposable = xtermRef.current?.onResize((sizes) => {
            if (connectedRef.current) {
                api.resizePty(sessionId, sizes.cols, sizes.rows).catch(console.error);
            }
        });

        return () => {
            isMounted = false;
            onDataDisposable?.dispose();
            onResizeDisposable?.dispose();
        };
    }, [profile, sessionId]);

    // Handle window resize triggering terminal fit
    useEffect(() => {
        const handleResize = () => {
            if (isActive && fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);

        // Fit when becoming active
        if (isActive) {
            setTimeout(() => handleResize(), 10);
        }

        return () => window.removeEventListener('resize', handleResize);
    }, [isActive]);

    // Position the ghost text overlay near the cursor
    useEffect(() => {
        if (!ghostText || !xtermRef.current || !ghostRef.current || !terminalRef.current) {
            return;
        }
        const term = xtermRef.current;
        const cursorX = term.buffer.active.cursorX;
        const cursorY = term.buffer.active.cursorY;

        // Calculate pixel position using cell dimensions
        const cellWidth = term.element?.querySelector('.xterm-char-measure-element')?.getBoundingClientRect().width || 9;
        const cellHeight = (term.element?.querySelector('.xterm-rows')?.getBoundingClientRect().height || 0) / term.rows || 18;

        const left = cursorX * cellWidth + 10; // +10 for padding
        const top = cursorY * cellHeight + 4;

        ghostRef.current.style.left = `${left}px`;
        ghostRef.current.style.top = `${top}px`;
        ghostRef.current.style.fontSize = `${terminalFont.fontSize}px`;
        ghostRef.current.style.fontFamily = terminalFont.fontFamily;
        ghostRef.current.style.lineHeight = `${cellHeight}px`;
    }, [ghostText, terminalFont]);

    // Keyboard shortcuts for Ctrl+F (search) and Ctrl+R (history)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isActive) return;

            // Ctrl+F: Toggle search bar
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                setShowSearchBar(prev => !prev);
                setShowHistorySearch(false);
            }

            // Ctrl+R: Toggle history search
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                e.stopPropagation();
                setShowHistorySearch(prev => !prev);
                setShowSearchBar(false);
            }

            // Ctrl+L: Toggle line numbers
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                setShowLineNumbers(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isActive]);

    // Update line number data when scrolling
    useEffect(() => {
        if (!showLineNumbers || !xtermRef.current) return;

        const term = xtermRef.current;
        const updateLineNumbers = () => {
            const viewportY = term.buffer.active.viewportY;
            setLineNumberData({
                start: viewportY + 1,
                count: term.rows,
            });
        };

        updateLineNumbers();

        // Listen for scroll events
        const scrollDisposable = term.onScroll(() => updateLineNumbers());
        const writeDisposable = term.onWriteParsed(() => updateLineNumbers());

        return () => {
            scrollDisposable.dispose();
            writeDisposable.dispose();
        };
    }, [showLineNumbers]);

    // Handle history search selection — send selected command to PTY
    const handleHistorySelect = useCallback((command: string) => {
        if (!connectedRef.current) return;
        const encoder = new TextEncoder();
        // Clear current line (Ctrl+U), then type the command
        const clearLine = '\x15'; // Ctrl+U
        const bytes = Array.from(encoder.encode(clearLine + command));
        api.writeToPty(sessionId, bytes).catch(console.error);
        setShowHistorySearch(false);
    }, [sessionId]);

    return (
        <div
            className="w-full h-full flex flex-row"
        >
            {!paneMode && <FileBrowser profile={profile} sessionId={sessionId} isActive={isActive} />}

            <div className="flex-1 relative h-full">
                {/* Line Numbers Gutter */}
                {showLineNumbers && (
                    <div
                        className="absolute left-0 top-0 bottom-0 z-10 select-none pointer-events-none overflow-hidden"
                        style={{
                            width: 40,
                            paddingTop: 8,
                            paddingLeft: 4,
                            fontFamily: terminalFont.fontFamily,
                            fontSize: `${terminalFont.fontSize}px`,
                            lineHeight: terminalFont.lineHeight,
                            color: 'var(--text-dimmed)',
                            opacity: 0.4,
                            background: 'linear-gradient(90deg, var(--bg-sidebar) 0%, transparent 100%)',
                        }}
                    >
                        {Array.from({ length: lineNumberData.count }, (_, i) => (
                            <div
                                key={i}
                                className="text-right pr-1 tabular-nums"
                                style={{
                                    height: `${100 / lineNumberData.count}%`,
                                    lineHeight: `${100 / lineNumberData.count}vh`,
                                }}
                            >
                                {lineNumberData.start + i}
                            </div>
                        ))}
                    </div>
                )}

                <div
                    ref={terminalRef}
                    className="absolute inset-0 p-2 overflow-hidden"
                    style={{
                        backgroundColor: terminalTheme.id === 'appTheme' ? theme.colors.bgPrimary : terminalTheme.colors.background,
                        paddingLeft: showLineNumbers ? 44 : undefined,
                    }}
                />

                {/* Search Bar Overlay (Ctrl+F) */}
                {showSearchBar && (
                    <TerminalSearchBar
                        searchAddon={searchAddonRef.current}
                        onClose={() => setShowSearchBar(false)}
                    />
                )}

                {/* History Search Overlay (Ctrl+R) */}
                {showHistorySearch && (
                    <TerminalHistorySearch
                        predictor={predictor}
                        onSelect={handleHistorySelect}
                        onClose={() => setShowHistorySearch(false)}
                    />
                )}

                {/* ML Autocomplete Ghost Text Overlay */}
                {ghostText && connected && (
                    <div
                        ref={ghostRef}
                        className="absolute pointer-events-none z-20 select-none whitespace-pre"
                        style={{
                            color: 'var(--text-muted)',
                            opacity: 0.45,
                            textShadow: '0 0 1px rgba(var(--accent-rgb, 99, 102, 241), 0.3)',
                        }}
                    >
                        {ghostText}
                        <span
                            className="ml-2 text-[10px] opacity-60 border border-current rounded px-1 py-0 align-middle"
                            style={{ fontSize: '9px' }}
                        >
                            Tab ⏎
                        </span>
                    </div>
                )}

                {!connected && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
                        <div className="bg-[var(--bg-sidebar)] px-4 py-2 rounded-md border border-[var(--border-color)] shadow-lg animate-pulse text-sm">
                            Connecting...
                        </div>
                    </div>
                )}
            </div>

            {!paneMode && <SnippetManager profile={profile} sessionId={sessionId} isActive={isActive} />}
        </div>
    );
};
