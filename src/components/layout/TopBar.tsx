import React, { useRef, useEffect, useState } from 'react';
import {
    X, Columns2, Activity, Globe, Container,
} from 'lucide-react';

export interface TabData {
    id: string;
    title: string;
    color?: string;
}

interface TopBarProps {
    tabs: TabData[];
    activeTab: string | null;
    onTabClose: (id: string) => void;
    onTabSelect: (id: string) => void;
    onSplit?: (id: string) => void;
    onToggleMonitor?: (id: string) => void;
    isMonitorOpen?: boolean;
    onToggleNetworkTools?: (id: string) => void;
    isNetworkToolsOpen?: boolean;
    onToggleDockerManager?: (id: string) => void;
    isDockerManagerOpen?: boolean;
}

/* ── Toolbar action button ──────────────────────────────── */
interface ToolBtnProps {
    onClick: (e: React.MouseEvent) => void;
    active?: boolean;
    title: string;
    activeColor?: string;
    children: React.ReactNode;
}

const ToolBtn: React.FC<ToolBtnProps> = ({ onClick, active, title, activeColor, children }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className="tab-tool-btn"
        style={{
            color: active ? (activeColor || 'var(--accent-color)') : undefined,
            opacity: active ? 1 : undefined,
        }}
        title={title}
    >
        {children}
    </button>
);

/* ── Middle-click handler ───────────────────────────────── */
const useMiddleClick = (ref: React.RefObject<HTMLDivElement | null>, onMiddleClick: () => void) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handler = (e: MouseEvent) => { if (e.button === 1) { e.preventDefault(); onMiddleClick(); } };
        el.addEventListener('mousedown', handler);
        return () => el.removeEventListener('mousedown', handler);
    }, [ref, onMiddleClick]);
};

/* ── Main component ─────────────────────────────────────── */
export const TopBar: React.FC<TopBarProps> = ({
    tabs, activeTab, onTabClose, onTabSelect,
    onSplit, onToggleMonitor, isMonitorOpen,
    onToggleNetworkTools, isNetworkToolsOpen,
    onToggleDockerManager, isDockerManagerOpen,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Horizontal scroll with mouse wheel
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    return (
        <div className="topbar-container">
            {/* Tabs scroll area */}
            <div ref={scrollRef} className="topbar-tabs hide-scrollbar">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <Tab
                            key={tab.id}
                            tab={tab}
                            isActive={isActive}
                            onSelect={() => onTabSelect(tab.id)}
                            onClose={() => onTabClose(tab.id)}
                            onSplit={onSplit ? () => onSplit(tab.id) : undefined}
                            onToggleMonitor={isActive && onToggleMonitor ? () => onToggleMonitor(tab.id) : undefined}
                            isMonitorOpen={isActive ? isMonitorOpen : false}
                            onToggleNetworkTools={isActive && onToggleNetworkTools ? () => onToggleNetworkTools(tab.id) : undefined}
                            isNetworkToolsOpen={isActive ? isNetworkToolsOpen : false}
                            onToggleDockerManager={isActive && onToggleDockerManager ? () => onToggleDockerManager(tab.id) : undefined}
                            isDockerManagerOpen={isActive ? isDockerManagerOpen : false}
                        />
                    );
                })}
            </div>

            {/* Active tab toolbar (shown on the right, outside tabs) */}
            {activeTab && (
                <div className="topbar-toolbar">
                    {onSplit && (
                        <ToolBtn onClick={() => onSplit(activeTab)} title="Split pane (Ctrl+Shift+H)">
                            <Columns2 size={14} />
                        </ToolBtn>
                    )}
                    {onToggleMonitor && (
                        <ToolBtn onClick={() => onToggleMonitor(activeTab)} active={isMonitorOpen} title="Server Monitor">
                            <Activity size={14} />
                        </ToolBtn>
                    )}
                    {onToggleNetworkTools && (
                        <ToolBtn onClick={() => onToggleNetworkTools(activeTab)} active={isNetworkToolsOpen} title="Network Tools">
                            <Globe size={14} />
                        </ToolBtn>
                    )}
                    {onToggleDockerManager && (
                        <ToolBtn onClick={() => onToggleDockerManager(activeTab)} active={isDockerManagerOpen} activeColor="#2496ED" title="Docker Containers">
                            <Container size={14} />
                        </ToolBtn>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Individual Tab ─────────────────────────────────────── */

interface TabProps {
    tab: TabData;
    isActive: boolean;
    onSelect: () => void;
    onClose: () => void;
    onSplit?: () => void;
    onToggleMonitor?: () => void;
    isMonitorOpen?: boolean;
    onToggleNetworkTools?: () => void;
    isNetworkToolsOpen?: boolean;
    onToggleDockerManager?: () => void;
    isDockerManagerOpen?: boolean;
}

const Tab: React.FC<TabProps> = ({ tab, isActive, onSelect, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    useMiddleClick(ref, onClose);

    return (
        <div
            ref={ref}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`topbar-tab ${isActive ? 'topbar-tab--active' : ''}`}
            style={{
                '--tab-color': tab.color || 'var(--accent-color)',
            } as React.CSSProperties}
        >
            {/* Connection color dot */}
            <span
                className="topbar-tab-dot"
                style={{ background: tab.color || 'var(--accent-color)' }}
            />

            {/* Title */}
            <span className="topbar-tab-title">{tab.title}</span>

            {/* Close button */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className={`topbar-tab-close ${isActive || isHovered ? 'topbar-tab-close--visible' : ''}`}
            >
                <X size={12} />
            </button>

            {/* Active indicator line */}
            {isActive && <span className="topbar-tab-indicator" style={{ background: tab.color || 'var(--accent-color)' }} />}
        </div>
    );
};
