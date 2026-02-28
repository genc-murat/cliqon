import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SharingProvider } from "./contexts/SharingContext";
import { ConnectionsProvider } from "./contexts/ConnectionsContext";
import { ConfirmProvider } from "./hooks/useConfirm";
import { SnippetsProvider } from "./contexts/SnippetsContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ConnectionsProvider>
        <SnippetsProvider>
          <SharingProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </SharingProvider>
        </SnippetsProvider>
      </ConnectionsProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
