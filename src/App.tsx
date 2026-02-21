import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar, TabData } from "./components/layout/TopBar";
import { TerminalViewer } from "./components/terminal/TerminalViewer";
import { SshProfile } from "./types/connection";

interface SessionTab extends TabData {
  profile: SshProfile;
}

function App() {
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-main)] transition-colors duration-200">
      <Sidebar onConnect={handleConnect} />

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
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] opacity-50 flex-col gap-4 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>
              <p>Select a connection from the left to start</p>
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
