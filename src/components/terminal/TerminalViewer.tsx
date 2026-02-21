import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { FileBrowser } from './FileBrowser';
import { SnippetManager } from './SnippetManager';
// Make sure to import xterm styles
import '@xterm/xterm/css/xterm.css';

interface TerminalViewerProps {
    profile: SshProfile;
    sessionId: string;
    isActive: boolean;
}

export const TerminalViewer: React.FC<TerminalViewerProps> = ({ profile, sessionId, isActive }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const unlistenRxRef = useRef<UnlistenFn | null>(null);
    const unlistenCloseRef = useRef<UnlistenFn | null>(null);
    const [connected, setConnected] = useState(false);
    const connectedRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const { theme, terminalTheme, terminalFont } = useTheme();

    const getXtermTheme = useCallback(() => {
        if (terminalTheme.id === 'appTheme') {
            return {
                background: theme.colors.bgPrimary,
                foreground: theme.colors.textMain,
                cursor: theme.colors.accent,
                selectionBackground: theme.colors.hover,
                ...terminalTheme.colors,
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
            fontFamily: terminalFont.fontFamily,
            fontSize: terminalFont.fontSize,
            lineHeight: terminalFont.lineHeight,
            theme: getXtermTheme()
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

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
                        xtermRef.current.write(new Uint8Array(event.payload));
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

        // Handle user input
        const onDataDisposable = xtermRef.current?.onData((data) => {
            if (connectedRef.current) {
                // Convert string to byte array
                const encoder = new TextEncoder();
                const bytes = Array.from(encoder.encode(data));
                api.writeToPty(sessionId, bytes).catch(console.error);
            }
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

    return (
        <div
            className="w-full h-full flex flex-row"
            style={{ display: isActive ? 'flex' : 'none' }}
        >
            <FileBrowser profile={profile} sessionId={sessionId} isActive={isActive} />

            <div className="flex-1 relative h-full">
                <div
                    ref={terminalRef}
                    className="absolute inset-0 p-2 overflow-hidden"
                    style={{ backgroundColor: terminalTheme.id === 'appTheme' ? theme.colors.bgPrimary : terminalTheme.colors.background }}
                />
                {!connected && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
                        <div className="bg-[var(--bg-sidebar)] px-4 py-2 rounded-md border border-[var(--border-color)] shadow-lg animate-pulse text-sm">
                            Connecting...
                        </div>
                    </div>
                )}
            </div>

            <SnippetManager profile={profile} sessionId={sessionId} isActive={isActive} />
        </div>
    );
};
