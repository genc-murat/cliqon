import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar, TabData } from "./components/layout/TopBar";
import { TitleBar } from "./components/layout/TitleBar";
import { SplitView, Pane } from './components/terminal/SplitView';
import { ManagementPanel, ManagementTab } from './components/terminal/ManagementPanel';
import { useTheme } from "./hooks/useTheme";
import { SshProfile } from "./types/connection";
import { api } from "./services/api";
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { SessionTimeoutOverlay } from './components/ui/SessionTimeoutOverlay';
import { useConfirm } from './hooks/useConfirm';
import { SharingPanel } from './components/ui/SharingPanel';
import { useConnections } from './hooks/useConnections';
import { useUpdater } from './hooks/useUpdater';
import { CommandPalette } from './components/ui/CommandPalette';
import { Dashboard } from './components/ui/Dashboard';

interface SessionTab extends TabData {
  profile: SshProfile;
  panes: Pane[];
  activePane: string | null;
  managementPanelOpen: boolean;
  activeManagementTab: ManagementTab;
}

function App() {
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const { profiles, refresh, recordUsage } = useConnections();

  // Refs to allow keyboard shortcuts to trigger sidebar actions
  const openAddModalRef = useRef<(() => void) | null>(null);
  const focusSearchRef = useRef<(() => void) | null>(null);
  const { autoOpenMonitor, sessionTimeout } = useTheme();

  const { isTimedOut, resetTimeout } = useSessionTimeout(tabs.length > 0 ? sessionTimeout : 0);
  const { checkForUpdates, status: updateStatus, manifest: updateManifest } = useUpdater();
  const [hasNotifiedUpdate, setHasNotifiedUpdate] = useState(false);
  const confirm = useConfirm();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    // Initial check on startup
    checkForUpdates(true);

    // Periodic check every 6 hours
    const interval = setInterval(() => {
      checkForUpdates(true);
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkForUpdates]);

  // Notify user when an update is available
  useEffect(() => {
    if (updateStatus === 'available' && updateManifest && !hasNotifiedUpdate) {
      setHasNotifiedUpdate(true);
      confirm({
        title: 'Update Available',
        message: `A new version (${updateManifest.version}) of Cliqon is available. Would you like to go to settings to install it?`,
        confirmLabel: 'Go to Settings',
        cancelLabel: 'Later'
      }).then((confirmed: boolean) => {
        if (confirmed) {
          // Find settings icon or just open settings modal?
          // SettingsModal is in Sidebar.tsx, which we don't control here directly.
          // But we can dispatch an event or just let them see the badge.
          // For now, let's just trigger the settings modal via a global event if we can.
          window.dispatchEvent(new CustomEvent('cliqon:open-settings'));
        }
      });
    }
  }, [updateStatus, updateManifest, hasNotifiedUpdate, confirm]);

  const handleConnect = (profile: SshProfile) => {
    const sessionId = crypto.randomUUID();
    const pane: Pane = { id: sessionId, profile };
    const newTab: SessionTab = {
      id: sessionId,
      title: profile.name,
      profile,
      color: profile.color,
      panes: [pane],
      activePane: pane.id,
      managementPanelOpen: autoOpenMonitor,
      activeManagementTab: 'monitor',
    };
    recordUsage(profile.id);
    setTabs(prev => [...prev, newTab]);
    setActiveTab(sessionId);
  };

  const handleSplitPane = (tabId: string) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab;
      const newPane: Pane = { id: crypto.randomUUID(), profile: tab.profile };
      return { ...tab, panes: [...tab.panes, newPane], activePane: newPane.id };
    }));
  };

  const handlePaneClose = (tabId: string, paneId: string) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab;
      const remaining = tab.panes.filter(p => p.id !== paneId);
      if (remaining.length === 0) return tab; // Don't close last pane via this path
      const newActive = tab.activePane === paneId ? remaining[remaining.length - 1].id : tab.activePane;
      return { ...tab, panes: remaining, activePane: newActive };
    }));
  };

  const handlePaneActivate = (tabId: string, paneId: string) => {
    setTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, activePane: paneId } : tab));
  };

  const handleTabClose = (id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;

      const nextTabs = prev.filter(t => t.id !== id);

      // Update active tab logic
      if (activeTab === id) {
        if (nextTabs.length > 0) {
          // Switch to the previous tab, or the first one if closing the 0th
          const nextActiveIdx = Math.max(0, idx - 1);
          setActiveTab(nextTabs[nextActiveIdx].id);
        } else {
          setActiveTab(null);
        }
      }
      return nextTabs;
    });
  };

  const handleCloseActiveTabAndUnlock = () => {
    if (activeTab) {
      handleTabClose(activeTab);
      resetTimeout();
    }
  };

  const handleToggleManagementPanel = (tabId: string, type: ManagementTab) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) return tab;

      const isOpen = tab.managementPanelOpen;
      const currentTab = tab.activeManagementTab;

      if (isOpen && currentTab === type) {
        // Toggling the same icon closes the panel
        return { ...tab, managementPanelOpen: false };
      } else {
        // Toggling a different icon or opening from closed state
        return { ...tab, managementPanelOpen: true, activeManagementTab: type };
      }
    }));
  };

  const handleViewDockerLogs = (tabId: string, containerId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tab.activePane) return;

    // Clear the terminal and then run docker logs
    // Sending \x0L or 'clear' command. Most modern terminals respond to 'clear\n'
    const command = `clear\ndocker logs -f --tail 100 ${containerId}\n`;
    const encoder = new TextEncoder();
    api.writeToPty(tab.activePane, Array.from(encoder.encode(command))).catch(console.error);
  };

  const handleDockerExec = (tabId: string, containerId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tab.activePane) return;

    // Clear the terminal and connect interactively via bash or sh
    const command = `clear\ndocker exec -it ${containerId} /bin/sh -c "(bash || sh) 2>/dev/null"\n`;
    const encoder = new TextEncoder();
    api.writeToPty(tab.activePane, Array.from(encoder.encode(command))).catch(console.error);
  };

  const handleClearTerminal = () => {
    if (!activeTab) return;
    const tab = tabs.find(t => t.id === activeTab);
    if (!tab || !tab.activePane) return;

    const command = `clear\n`;
    const encoder = new TextEncoder();
    api.writeToPty(tab.activePane, Array.from(encoder.encode(command))).catch(console.error);
  };

  // ─── Global Keyboard Shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      // Ctrl+Tab / Ctrl+Shift+Tab → cycle through SSH tabs
      if (e.key === 'Tab') {
        e.preventDefault();
        setTabs(prev => {
          if (prev.length < 2) return prev;
          const idx = prev.findIndex(t => t.id === activeTab);
          const next = e.shiftKey
            ? (idx - 1 + prev.length) % prev.length
            : (idx + 1) % prev.length;
          setActiveTab(prev[next].id);
          return prev;
        });
        return;
      }

      // Ctrl+N → Open "Add connection" modal
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openAddModalRef.current?.();
        return;
      }

      // Ctrl+B → Toggle SFTP browser panel
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('cliqon:toggle-sftp'));
        return;
      }

      // Ctrl+F → Focus sidebar search
      if (e.key === 'f' || e.key === 'F') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        focusSearchRef.current?.();
        return;
      }

      // Ctrl+Shift+H → Split terminal horizontally (side-by-side)
      if ((e.key === 'h' || e.key === 'H') && e.shiftKey && activeTab) {
        e.preventDefault();
        handleSplitPane(activeTab);
        return;
      }

      // Ctrl+K → Toggle Command Palette
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }
    };

    const handleCloseActiveTab = () => {
      if (activeTab) handleTabClose(activeTab);
    };

    const handleSplit = () => {
      if (activeTab) handleSplitPane(activeTab);
    };

    const handleCycleTabs = (forward: boolean) => {
      setTabs(prev => {
        if (prev.length < 2) return prev;
        const idx = prev.findIndex(t => t.id === activeTab);
        const next = forward
          ? (idx + 1) % prev.length
          : (idx - 1 + prev.length) % prev.length;
        setActiveTab(prev[next].id);
        return prev;
      });
    };

    const handleExitApp = async () => {
      try {
        const { exit } = await import('@tauri-apps/plugin-process');
        await exit(0);
      } catch (err) {
        window.close();
      }
    };

    window.addEventListener('cliqon:close-active-tab', handleCloseActiveTab);
    window.addEventListener('cliqon:split-pane', handleSplit);
    window.addEventListener('cliqon:next-tab', () => handleCycleTabs(true));
    window.addEventListener('cliqon:prev-tab', () => handleCycleTabs(false));
    window.addEventListener('cliqon:check-updates', () => checkForUpdates());
    window.addEventListener('cliqon:exit-app', handleExitApp);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('cliqon:close-active-tab', handleCloseActiveTab);
      window.removeEventListener('cliqon:split-pane', handleSplit);
      window.removeEventListener('cliqon:next-tab', () => handleCycleTabs(true));
      window.removeEventListener('cliqon:prev-tab', () => handleCycleTabs(false));
      window.removeEventListener('cliqon:check-updates', () => checkForUpdates());
      window.removeEventListener('cliqon:exit-app', handleExitApp);
    };
  }, [activeTab, checkForUpdates]);

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-main)] transition-colors duration-200">
      {/* Gradient Background Overlay */}
      <div
        className="theme-gradient-overlay gradient-diagonal"
        style={{
          '--gradient-from': 'var(--gradient-from)',
          '--gradient-to': 'var(--gradient-to)',
        } as React.CSSProperties}
      />

      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          onConnect={handleConnect}
          openAddModalRef={openAddModalRef}
          focusSearchRef={focusSearchRef}
        />

        <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] min-w-0">
          <TopBar
            tabs={tabs}
            activeTab={activeTab}
            onTabClose={handleTabClose}
            onTabSelect={(id) => setActiveTab(id)}
            onSplit={handleSplitPane}
            onToggleMonitor={(id) => handleToggleManagementPanel(id, 'monitor')}
            isMonitorOpen={tabs.find(t => t.id === activeTab)?.managementPanelOpen && tabs.find(t => t.id === activeTab)?.activeManagementTab === 'monitor'}
            onToggleNetworkTools={(id) => handleToggleManagementPanel(id, 'network')}
            isNetworkToolsOpen={tabs.find(t => t.id === activeTab)?.managementPanelOpen && tabs.find(t => t.id === activeTab)?.activeManagementTab === 'network'}
            onToggleDockerManager={(id) => handleToggleManagementPanel(id, 'docker')}
            isDockerManagerOpen={tabs.find(t => t.id === activeTab)?.managementPanelOpen && tabs.find(t => t.id === activeTab)?.activeManagementTab === 'docker'}
            onToggleTunnels={(id) => handleToggleManagementPanel(id, 'tunnels')}
            isTunnelsOpen={tabs.find(t => t.id === activeTab)?.managementPanelOpen && tabs.find(t => t.id === activeTab)?.activeManagementTab === 'tunnels'}
          />

          {/* Main Terminal Area */}
          <div className="flex-1 p-0 overflow-hidden relative">
            {isTimedOut && <SessionTimeoutOverlay onReconnect={resetTimeout} onClose={handleCloseActiveTabAndUnlock} />}

            {!isTimedOut && tabs.length === 0 ? (
              <Dashboard
                profiles={profiles}
                onConnect={handleConnect}
                onNewConnection={() => openAddModalRef.current?.()}
                onOpenSettings={() => window.dispatchEvent(new CustomEvent('cliqon:open-settings'))}
                onViewAll={() => focusSearchRef.current?.()}
                onToggleSharing={() => window.dispatchEvent(new CustomEvent('cliqon:toggle-sharing'))}
                onOpenImport={() => window.dispatchEvent(new CustomEvent('cliqon:open-import'))}
                onCheckUpdates={() => checkForUpdates()}
              />
            ) : !isTimedOut && (
              tabs.map((tab) => (
                <div key={tab.id} className={`absolute inset-0 flex flex-col ${activeTab === tab.id ? '' : 'hidden'}`}>
                  <div className="flex-1 relative min-h-0">
                    <SplitView
                      panes={tab.panes}
                      activePane={tab.activePane}
                      isTabActive={activeTab === tab.id}
                      onPaneClose={(paneId) => handlePaneClose(tab.id, paneId)}
                      onPaneActivate={(paneId) => handlePaneActivate(tab.id, paneId)}
                    />
                  </div>
                  {tab.managementPanelOpen && activeTab === tab.id && (
                    <ManagementPanel
                      profile={tab.profile}
                      sessionId={tab.id}
                      activeTab={tab.activeManagementTab}
                      onTabChange={(type) => handleToggleManagementPanel(tab.id, type)}
                      onClose={() => handleToggleManagementPanel(tab.id, tab.activeManagementTab)}
                      onViewDockerLogs={(containerId) => handleViewDockerLogs(tab.id, containerId)}
                      onDockerExec={(containerId) => handleDockerExec(tab.id, containerId)}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <SharingPanel profiles={profiles} onProfilesChanged={refresh} />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        profiles={profiles}
        activeTabId={activeTab}
        onConnect={handleConnect}
        onToggleManagement={(type) => activeTab && handleToggleManagementPanel(activeTab, type)}
        onClearTerminal={handleClearTerminal}
      />
    </div>
  );
}

export default App;
