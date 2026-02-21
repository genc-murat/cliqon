import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalViewer } from './TerminalViewer';
import { FileBrowser } from './FileBrowser';
import { SnippetManager } from './SnippetManager';
import { SshProfile } from '../../types/connection';
import { Minus } from 'lucide-react';

export interface Pane {
    id: string;
    profile: SshProfile;
}

interface SplitViewProps {
    panes: Pane[];
    activePane: string | null;
    onPaneClose: (paneId: string) => void;
    onPaneActivate: (paneId: string) => void;
    isTabActive: boolean;
}

export const SplitView: React.FC<SplitViewProps> = ({ panes, activePane, onPaneClose, onPaneActivate, isTabActive }) => {
    // Split sizes as percentages; first pane fills rest
    const [sizes, setSizes] = useState<number[]>(() => panes.map(() => 100 / panes.length));
    const containerRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef<{ divider: number; startX: number; startSizes: number[] } | null>(null);

    const handleDividerMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
        e.preventDefault();
        draggingRef.current = { divider: idx, startX: e.clientX, startSizes: [...sizes] };

        const onMove = (ev: MouseEvent) => {
            if (!draggingRef.current || !containerRef.current) return;
            const { divider, startX, startSizes } = draggingRef.current;
            const totalWidth = containerRef.current.clientWidth;
            const delta = ((ev.clientX - startX) / totalWidth) * 100;
            const next = [...startSizes];
            const minSize = 15;
            const newLeft = Math.max(minSize, next[divider] + delta);
            const newRight = Math.max(minSize, next[divider + 1] - delta);
            // Prevent pushing past minimum
            if (newLeft >= minSize && newRight >= minSize) {
                next[divider] = newLeft;
                next[divider + 1] = newRight;
                draggingRef.current.startX = ev.clientX;
                draggingRef.current.startSizes = next;
                setSizes([...next]);
            }
        };
        const onUp = () => {
            draggingRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new Event('resize'));
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [sizes]);

    // Reset sizes when pane count changes
    useEffect(() => {
        setSizes(panes.map(() => 100 / panes.length));
    }, [panes.length]);

    const multiPane = panes.length > 1;
    const firstPane = panes[0];

    return (
        <div
            ref={containerRef}
            className="flex h-full w-full overflow-hidden absolute inset-0"
            style={{ display: isTabActive ? 'flex' : 'none' }}
        >
            {/* SFTP FileBrowser — once per tab */}
            <FileBrowser profile={firstPane.profile} sessionId={firstPane.id} isActive={isTabActive} />

            {/* Terminal split area */}
            <div className="flex flex-1 h-full overflow-hidden">
                {panes.map((pane, i) => (
                    <React.Fragment key={pane.id}>
                        {/* Pane wrapper */}
                        <div
                            className={`relative flex flex-col h-full overflow-hidden ${multiPane && activePane === pane.id && isTabActive ? 'ring-1 ring-[var(--accent-color)] ring-inset' : ''}`}
                            style={{ width: multiPane ? `${sizes[i] ?? 100 / panes.length}%` : '100%' }}
                            onClick={() => onPaneActivate(pane.id)}
                        >
                            {/* Pane header bar (only when multiple panes) */}
                            {multiPane && (
                                <div className={`flex items-center justify-between px-2 py-0.5 text-[10px] font-mono shrink-0 ${activePane === pane.id && isTabActive ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)]' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)]'} border-b border-[var(--border-color)]`}>
                                    <span className="truncate">{pane.profile.name} — {pane.profile.username}@{pane.profile.host}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onPaneClose(pane.id); }}
                                        className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0 ml-1"
                                        title="Close pane"
                                    >
                                        <Minus size={10} />
                                    </button>
                                </div>
                            )}
                            <div className="flex-1 overflow-hidden">
                                <TerminalViewer
                                    profile={pane.profile}
                                    sessionId={pane.id}
                                    isActive={isTabActive}
                                    paneMode={true}
                                />
                            </div>
                        </div>

                        {/* Draggable divider between panes */}
                        {i < panes.length - 1 && (
                            <div
                                className="w-1 bg-[var(--border-color)] hover:bg-[var(--accent-color)] cursor-col-resize shrink-0 transition-colors z-10"
                                onMouseDown={(e) => handleDividerMouseDown(e, i)}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* SnippetManager — once per tab */}
            <SnippetManager profile={firstPane.profile} sessionId={firstPane.id} isActive={isTabActive} />
        </div>
    );
};
