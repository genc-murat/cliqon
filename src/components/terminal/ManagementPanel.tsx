import React from 'react';
import { Activity, Globe, Box, X } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { useResizable } from '../../hooks/useResizable';
import { ServerMonitor } from './ServerMonitor';
import { NetworkTools } from './NetworkTools';
import { DockerManager } from './DockerManager';

export type ManagementTab = 'monitor' | 'network' | 'docker';

interface ManagementPanelProps {
    profile: SshProfile;
    sessionId: string;
    activeTab: ManagementTab;
    onTabChange: (tab: ManagementTab) => void;
    onClose: () => void;
    onViewDockerLogs: (containerId: string) => void;
    onDockerExec: (containerId: string) => void;
}

export const ManagementPanel: React.FC<ManagementPanelProps> = ({
    profile,
    sessionId,
    activeTab,
    onTabChange,
    onClose,
    onViewDockerLogs,
    onDockerExec
}) => {
    const { height, startResizing, isResizing } = useResizable(
        320, // default height
        200, // min height
        800, // max height
        'top',
        'cliqon-management-panel-height'
    );

    const tabs: { id: ManagementTab; label: string; icon: React.ReactNode; color: string }[] = [
        { id: 'monitor', label: 'Monitor', icon: <Activity size={14} />, color: 'var(--accent-color)' },
        { id: 'network', label: 'Network', icon: <Globe size={14} />, color: '#10B981' },
        { id: 'docker', label: 'Docker', icon: <Box size={14} />, color: '#2496ED' },
    ];

    return (
        <div
            className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-hidden relative flex flex-col"
            style={{ height }}
        >
            {/* Resize Handle */}
            <div
                onMouseDown={startResizing}
                className={`
                    absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-50 
                    transition-colors duration-200 group
                    ${isResizing ? 'bg-[var(--accent-color)]' : 'hover:bg-[var(--accent-color)]/30'}
                `}
            >
                <div className={`
                    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                    w-12 h-1 rounded-full bg-[var(--border-color)] group-hover:bg-[var(--accent-color)]/50
                    transition-colors
                    ${isResizing ? 'bg-[var(--accent-color)]' : ''}
                `} />
            </div>

            {/* Panel Tab Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0 select-none">
                <div className="flex items-center gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                                flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-lg transition-all
                                ${activeTab === tab.id
                                    ? 'bg-[var(--hover-color)] text-[var(--text-main)] shadow-sm'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)]/50'}
                            `}
                        >
                            <span style={{ color: activeTab === tab.id ? tab.color : 'inherit' }}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Active Component Container */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {activeTab === 'monitor' && (
                    <ServerMonitor
                        profile={profile}
                        sessionId={sessionId}
                        onClose={onClose}
                        isEmbedded={true}
                    />
                )}
                {activeTab === 'network' && (
                    <NetworkTools
                        profile={profile}
                        sessionId={sessionId}
                        onClose={onClose}
                        isEmbedded={true}
                    />
                )}
                {activeTab === 'docker' && (
                    <DockerManager
                        profile={profile}
                        sessionId={sessionId}
                        onClose={onClose}
                        onViewLogs={onViewDockerLogs}
                        onExec={onDockerExec}
                        isEmbedded={true}
                    />
                )}
            </div>
        </div>
    );
};
