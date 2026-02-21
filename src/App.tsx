import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar, TabData } from "./components/layout/TopBar";
import { TerminalViewer } from "./components/terminal/TerminalViewer";
import { Logo } from './components/layout/Logo';
import { SshProfile } from "./types/connection";

interface SessionTab extends TabData {
  profile: SshProfile;
}

function App() {
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Refs to allow keyboard shortcuts to trigger sidebar actions
  const openAddModalRef = useRef<(() => void) | null>(null);
  const focusSearchRef = useRef<(() => void) | null>(null);

  const handleConnect = (profile: SshProfile) => {
    // Generate a unique session ID for this tab
    const sessionId = crypto.randomUUID();
    const newTab: SessionTab = {
      id: sessionId,
      title: profile.name,
      profile
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTab(sessionId);
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

      // Ctrl+B → Toggle SFTP browser panel (broadcast to active TerminalViewer)
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('cliqon:toggle-sftp'));
        return;
      }

      // Ctrl+F → Focus sidebar search
      if (e.key === 'f' || e.key === 'F') {
        // Only intercept when no other input is focused
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        focusSearchRef.current?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-main)] transition-colors duration-200">
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
        />

        {/* Main Terminal Area */}
        <div className="flex-1 p-0 overflow-hidden relative">
          {tabs.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] opacity-50 flex-col gap-6 select-none animate-in fade-in duration-1000">
              <Logo size={96} className="grayscale brightness-125 transition-all duration-700" style={{ filter: 'grayscale(1) opacity(0.2)' }} />
              <p className="text-sm font-medium tracking-wide uppercase">Cliqon terminal</p>
            </div>
          ) : (
            tabs.map((tab) => (
              <TerminalViewer
                key={tab.id}
                profile={tab.profile}
                sessionId={tab.id}
                isActive={activeTab === tab.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
