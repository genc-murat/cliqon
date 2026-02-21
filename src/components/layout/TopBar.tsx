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
    onToggleNetworkTools?: (id: string) => void;
    isNetworkToolsOpen?: boolean;
    onToggleDockerManager?: (id: string) => void;
    isDockerManagerOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ tabs, activeTab, onTabClose, onTabSelect, onSplit, onToggleMonitor, isMonitorOpen, onToggleNetworkTools, isNetworkToolsOpen, onToggleDockerManager, isDockerManagerOpen }) => {
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
                    {activeTab === tab.id && onToggleNetworkTools && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleNetworkTools(tab.id); }}
                            className={`rounded-md p-0.5 transition-opacity hover:bg-[var(--hover-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] ${isNetworkToolsOpen ? 'opacity-100 text-[var(--accent-color)]' : 'opacity-0 group-hover:opacity-100'}`}
                            title="Network Tools"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                        </button>
                    )}
                    {activeTab === tab.id && onToggleDockerManager && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleDockerManager(tab.id); }}
                            className={`rounded-md p-0.5 transition-opacity hover:bg-[var(--hover-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] ${isDockerManagerOpen ? 'opacity-100 text-[#2496ED]' : 'opacity-0 group-hover:opacity-100'}`}
                            title="Docker Containers"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.2 8.4A2.08 2.08 0 0 0 19.4 7a2.12 2.12 0 0 0-.2-1l-1.3-3.1A2.1 2.1 0 0 0 16.9 2H7.1A2.1 2.1 0 0 0 6.1 2.9L4.8 6a2.12 2.12 0 0 0-.2 1 2.08 2.08 0 0 0-1.8 1.4L1.2 13v6A2 2 0 0 0 3.2 21h17.6A2 2 0 0 0 22.8 19v-6z" /><path d="M7 11h10" /><path d="M7 15h10" /></svg>
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
