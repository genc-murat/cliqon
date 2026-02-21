import React from 'react';

export interface TabData {
    id: string; // usually session ID
    title: string;
}

interface TopBarProps {
    tabs: TabData[];
    activeTab: string | null;
    onTabClose: (id: string) => void;
    onTabSelect: (id: string) => void;
    onSplit?: (id: string) => void;
    onToggleMonitor?: (id: string) => void;
    isMonitorOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ tabs, activeTab, onTabClose, onTabSelect, onSplit, onToggleMonitor, isMonitorOpen }) => {
    return (
        <div className="h-[52px] w-full bg-[var(--bg-primary)] border-b border-[var(--border-color)] flex items-end px-2 gap-1 overflow-x-auto shrink-0 hide-scrollbar pt-2">
            {tabs.map((tab) => (
                <div
                    key={tab.id}
                    onClick={() => onTabSelect(tab.id)}
                    className={`
                        group flex items-center justify-between gap-3 px-4 py-2 min-w-[140px] max-w-[200px]
                        rounded-t-md cursor-pointer border border-b-0
                        transition-all duration-200 text-sm font-medium
                        ${activeTab === tab.id
                            ? 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-main)] z-10'
                            : 'bg-[var(--bg-sidebar)] border-transparent text-[var(--text-muted)] hover:bg-[var(--hover-color)]'
                        }
                    `}
                    style={{ marginBottom: activeTab === tab.id ? '-1px' : '0' }}
                >
                    <span className="truncate flex-1 select-none">{tab.title}</span>
                    {activeTab === tab.id && onSplit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onSplit(tab.id); }}
                            className="rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--hover-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                            title="Split pane (Ctrl+Shift+H)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
                        </button>
                    )}
                    {activeTab === tab.id && onToggleMonitor && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleMonitor(tab.id); }}
                            className={`rounded-md p-0.5 transition-opacity hover:bg-[var(--hover-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] ${isMonitorOpen ? 'opacity-100 text-[var(--accent-color)]' : 'opacity-0 group-hover:opacity-100'}`}
                            title="Server Monitor"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                        className={`
                            rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity
                            hover:bg-red-500/20 hover:text-red-400
                        `}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>
            ))}
        </div>
    );
};
