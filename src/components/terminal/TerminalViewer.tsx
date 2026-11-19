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
import { isUnknownHostKey, sshErrorMessage, useHostKeyTrust } from '../../hooks/useHostKeyTrust';
import { useTheme } from '../../hooks/useTheme';
import { useTerminalHistory } from '../../hooks/useTerminalHistory';
import { highlightShellInput } from '../../lib/shellHighlight';
import { FileBrowser } from './FileBrowser';
import { SnippetManager } from './SnippetManager';
import { TerminalSearchBar } from './TerminalSearchBar';
import { TerminalHistorySearch } from './TerminalHistorySearch';
import { ResourceMonitor } from './ResourceMonitor';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewerProps {
    profile: SshProfile;
    sessionId: string;
    isActive: boolean;
    paneMode?: boolean;
    onConnectionChange?: (sessionId: string, connected: boolean) => void;
}

interface GpuInfo {
    renderer: string;
    vendor: string;
}

export const TerminalViewer: React.FC<TerminalViewerProps> = ({ profile, sessionId, isActive, paneMode = false, onConnectionChange }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const [connected, setConnected] = useState(false);
    const approveHostKey = useHostKeyTrust();
    const connectedRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const { theme, terminalTheme, terminalFont, terminalCursorStyle, terminalPerformance, showResourceMonitor } = useTheme();
    const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
    const [rendererActive, setRendererActive] = useState<'webgl' | 'canvas' | null>(null);

    const { processKeystroke, updatePrediction, predictor, getCurrentInput, resetInput } = useTerminalHistory(profile.id, xtermRef);
    const refreshHighlightRef = useRef<(() => void) | null>(null);
    const [ghostText, setGhostText] = useState<string | null>(null);
    const ghostRef = useRef<HTMLDivElement>(null);
    const ghostTextRef = useRef<string | null>(null);
    const activeSuggestionRef = useRef<string | null>(null);

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
                ...(isLight ? {
                    black: '#000000',
                    white: '#333333',
                    brightWhite: '#000000',
                    yellow: '#859900',
                    brightYellow: '#b58900',
                } : {})
            };
        }
        return terminalTheme.colors;
    }, [theme, terminalTheme]);

    const getScrollbackLines = useCallback(() => {
        if (terminalPerformance.scrollbackMode === 'unlimited') {
            return 999999;
        }
        return terminalPerformance.scrollbackLines;
    }, [terminalPerformance]);

    useEffect(() => {
        connectedRef.current = connected;
    }, [connected]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const scrollback = getScrollbackLines();

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: terminalCursorStyle,
            fontFamily: terminalFont.fontFamily,
            fontSize: terminalFont.fontSize,
            lineHeight: terminalFont.lineHeight,
            scrollback,
            theme: getXtermTheme(),
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        const searchAddon = new SearchAddon();
        term.loadAddon(searchAddon);
        searchAddonRef.current = searchAddon;

        const webLinksAddon = new WebLinksAddon((_event, uri) => {
            window.open(uri, '_blank');
        });
        term.loadAddon(webLinksAddon);

        try {
            const clipboardAddon = new ClipboardAddon();
            term.loadAddon(clipboardAddon);
        } catch (e) {
            console.warn('Clipboard addon could not be loaded', e);
        }

        term.open(terminalRef.current);

        const shouldTryWebgl = terminalPerformance.rendererMode !== 'canvas';

        if (shouldTryWebgl) {
            try {
                const webglAddon = new WebglAddon();
                webglAddon.onContextLoss(() => {
                    console.warn('WebGL context lost');
                    webglAddon.dispose();
                    setRendererActive('canvas');
                });
                term.loadAddon(webglAddon);
                setRendererActive('webgl');

                const gl = (webglAddon as unknown as { _gl?: WebGLRenderingContext })._gl;
                if (gl && terminalPerformance.showFpsCounter) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        setGpuInfo({
                            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                        });
                    }
                }
            } catch (e) {
                console.warn('WebGL addon could not be loaded, falling back to canvas', e);
                setRendererActive('canvas');
                if (terminalPerformance.rendererMode === 'webgl') {
                    setError('WebGL renderer requested but not available. Using canvas fallback.');
                }
            }
        } else {
            setRendererActive('canvas');
        }

        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        return () => {
            term.dispose();
        };
    }, []);

    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getXtermTheme();
            refreshHighlightRef.current?.();
        }
    }, [getXtermTheme]);

    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.fontFamily = terminalFont.fontFamily;
            xtermRef.current.options.fontSize = terminalFont.fontSize;
            xtermRef.current.options.lineHeight = terminalFont.lineHeight;
            fitAddonRef.current?.fit();
        }
    }, [terminalFont]);

    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.cursorStyle = terminalCursorStyle;
        }
    }, [terminalCursorStyle]);

    useEffect(() => {
        let isMounted = true;
        let connectionRequested = false;
        let retriedHostKey = false;
        const listeners: UnlistenFn[] = [];
        const term = xtermRef.current;
        const commandHighlight = term && highlightShellInput(term);
        const refreshHighlight = () => commandHighlight?.update(getCurrentInput());
        refreshHighlightRef.current = refreshHighlight;
        const bufferChange = term?.buffer.onBufferChange(() => {
            resetInput();
            commandHighlight?.clear();
        });
        const isCurrent = () => isMounted;

        const addListener = async <T,>(event: string, handler: (payload: T) => void) => {
            if (!isMounted) return;
            const stop = await listen<T>(event, ({ payload }) => {
                if (isMounted) handler(payload);
            });
            if (isMounted) listeners.push(stop);
            else stop();
        };

        const reportError = async (error: unknown) => {
            if (!isMounted) return;
            setConnected(false);
            resetInput();
            commandHighlight?.clear();
            onConnectionChange?.(sessionId, false);
            if (isUnknownHostKey(error) && !retriedHostKey) {
                retriedHostKey = true;
                try {
                    if (await approveHostKey(profile, isCurrent)) {
                        await api.connectSsh(profile, sessionId);
                        if (!isMounted) await api.closePty(sessionId);
                        return;
                    }
                } catch (retryError) {
                    error = retryError;
                }
            }
            if (isMounted) setError(sshErrorMessage(error));
        };

        const setupConnection = async () => {
            if (!term) return;
            await addListener<{ status: string; message: string }>(`ssh_status_${sessionId}`, ({ status, message }) => {
                if (status === 'connected') {
                    setConnected(true);
                    setError(null);
                    onConnectionChange?.(sessionId, true);
                    term.writeln(message);
                    const dims = fitAddonRef.current?.proposeDimensions();
                    if (dims) api.resizePty(sessionId, dims.cols, dims.rows).catch(console.error);
                } else if (status === 'error') {
                    void reportError(message);
                } else {
                    term.writeln(message);
                }
            });
            await addListener<number[]>(`ssh_data_rx_${sessionId}`, (payload) => {
                const data = new Uint8Array(payload);
                term.write(data, () => {
                    if (!isMounted) return;
                    refreshHighlight();
                    const { ghostText, activeSuggestion } = updatePrediction();
                    setGhostText(ghostText);
                    ghostTextRef.current = ghostText;
                    activeSuggestionRef.current = activeSuggestion;
                });
            });
            await addListener(`ssh_close_${sessionId}`, () => {
                setConnected(false);
                resetInput();
                commandHighlight?.clear();
                setError('Connection closed by remote host.');
                onConnectionChange?.(sessionId, false);
            });

            if (!isMounted) return;
            connectionRequested = true;
            await api.connectSsh(profile, sessionId);
            if (!isMounted) await api.closePty(sessionId);
        };

        setupConnection().catch(reportError);

        const onDataDisposable = xtermRef.current?.onData((data) => {
            if (!connectedRef.current) return;

            const encoder = new TextEncoder();

            if ((data === '\t' || data === '\x1b[C') && activeSuggestionRef.current) {
                const remainder = ghostTextRef.current;
                if (remainder) {
                    const bytes = Array.from(encoder.encode(remainder));
                    api.writeToPty(sessionId, bytes).catch(console.error);
                    activeSuggestionRef.current = null;
                    ghostTextRef.current = null;
                    setGhostText(null);
                    return;
                }
            }

            // Alt+RightArrow for partial (word-by-word) completion
            if ((data === '\x1b[1;3C' || data === '\x1bf') && activeSuggestionRef.current) {
                const remainder = ghostTextRef.current;
                if (remainder) {
                    // Match the next word including trailing spaces
                    const match = remainder.match(/^(\s*\S+\s*)/);
                    if (match) {
                        const word = match[0];
                        const bytes = Array.from(encoder.encode(word));
                        api.writeToPty(sessionId, bytes).catch(console.error);
                        // Do not clear the suggestion here; let the next PTY echo trigger an updatePrediction
                        return;
                    }
                }
            }

            if (data === '\x1b' && activeSuggestionRef.current) {
                activeSuggestionRef.current = null;
                ghostTextRef.current = null;
                setGhostText(null);
            }

            if (data === '\r' || data === '\n') {
                commandHighlight?.submit(getCurrentInput());
            } else if (data === '\x03' || data === '\x15') {
                commandHighlight?.clear();
            }
            processKeystroke(data);

            const bytes = Array.from(encoder.encode(data));
            api.writeToPty(sessionId, bytes).catch(console.error);
        });

        const onResizeDisposable = xtermRef.current?.onResize((sizes) => {
            refreshHighlight();
            if (connectedRef.current) {
                api.resizePty(sessionId, sizes.cols, sizes.rows).catch(console.error);
            }
        });

        return () => {
            isMounted = false;
            listeners.forEach(unlisten => unlisten());
            if (connectionRequested) api.closePty(sessionId).catch(console.error);
            onConnectionChange?.(sessionId, false);
            refreshHighlightRef.current = null;
            resetInput();
            commandHighlight?.dispose();
            bufferChange?.dispose();
            onDataDisposable?.dispose();
            onResizeDisposable?.dispose();
        };
    }, [profile, sessionId, approveHostKey, onConnectionChange, getCurrentInput, resetInput]);

    useEffect(() => {
        const handleResize = () => {
            if (isActive && fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);

        if (isActive) {
            setTimeout(() => handleResize(), 10);
        }

        return () => window.removeEventListener('resize', handleResize);
    }, [isActive]);

    useEffect(() => {
        if (!ghostText || !xtermRef.current || !ghostRef.current || !terminalRef.current) {
            return;
        }
        const term = xtermRef.current;
        const cursorX = term.buffer.active.cursorX;
        const cursorY = term.buffer.active.cursorY;

        const cellWidth = term.element?.querySelector('.xterm-char-measure-element')?.getBoundingClientRect().width || 9;
        const cellHeight = (term.element?.querySelector('.xterm-rows')?.getBoundingClientRect().height || 0) / term.rows || 18;

        const left = cursorX * cellWidth + 10;
        const top = cursorY * cellHeight + 4;

        ghostRef.current.style.left = `${left}px`;
        ghostRef.current.style.top = `${top}px`;
        ghostRef.current.style.fontSize = `${terminalFont.fontSize}px`;
        ghostRef.current.style.fontFamily = terminalFont.fontFamily;
        ghostRef.current.style.lineHeight = `${cellHeight}px`;
    }, [ghostText, terminalFont]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isActive) return;

            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                setShowSearchBar(prev => !prev);
                setShowHistorySearch(false);
            }

            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                e.stopPropagation();
                setShowHistorySearch(prev => !prev);
                setShowSearchBar(false);
            }

            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                setShowLineNumbers(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isActive]);

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

        const scrollDisposable = term.onScroll(() => updateLineNumbers());
        const writeDisposable = term.onWriteParsed(() => updateLineNumbers());

        return () => {
            scrollDisposable.dispose();
            writeDisposable.dispose();
        };
    }, [showLineNumbers]);

    const handleHistorySelect = useCallback((command: string) => {
        if (!connectedRef.current) return;
        const encoder = new TextEncoder();
        const clearLine = '\x15';
        const bytes = Array.from(encoder.encode(clearLine + command));
        api.writeToPty(sessionId, bytes).catch(console.error);
        setShowHistorySearch(false);
    }, [sessionId]);

    return (
        <div
            className="w-full h-full flex flex-row"
        >
            {!paneMode && connected && <FileBrowser profile={profile} sessionId={sessionId} isActive={isActive} />}

            <div className="flex-1 relative h-full">
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

                {showSearchBar && (
                    <TerminalSearchBar
                        searchAddon={searchAddonRef.current}
                        onClose={() => setShowSearchBar(false)}
                    />
                )}

                {showHistorySearch && (
                    <TerminalHistorySearch
                        predictor={predictor}
                        onSelect={handleHistorySelect}
                        onClose={() => setShowHistorySearch(false)}
                    />
                )}

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

                {error && (
                    <div role="alert" className="absolute top-2 inset-x-3 z-10 rounded-md border border-red-500/40 bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-red-400 break-words">
                        {error}
                    </div>
                )}

                {!connected && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
                        <div className="bg-[var(--bg-sidebar)] px-4 py-2 rounded-md border border-[var(--border-color)] shadow-lg animate-pulse text-sm">
                            Connecting...
                        </div>
                    </div>
                )}

                {terminalPerformance.showFpsCounter && gpuInfo && (
                    <div className="absolute bottom-2 right-2 text-[10px] text-[var(--text-muted)] opacity-50 pointer-events-none">
                        {rendererActive}: {gpuInfo.renderer}
                    </div>
                )}

                <ResourceMonitor
                    profile={profile}
                    sessionId={sessionId}
                    show={showResourceMonitor}
                />
            </div>

            {!paneMode && <SnippetManager sessionId={sessionId} isActive={isActive} />}
        </div>
    );
};
