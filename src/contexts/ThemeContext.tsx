import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Theme, themes, TerminalTheme, terminalThemes, TerminalFont, defaultTerminalFont } from '../lib/themes';
import { storage } from '../lib/storage';
import { checkAndMigrate } from '../lib/migration';

export type ScrollbackMode = 'limited' | 'unlimited';
export type RendererMode = 'auto' | 'webgl' | 'canvas';

export interface TerminalPerformanceSettings {
    scrollbackLines: number;
    scrollbackMode: ScrollbackMode;
    outputThrottleMs: number;
    rendererMode: RendererMode;
    showFpsCounter: boolean;
}

const defaultPerformanceSettings: TerminalPerformanceSettings = {
    scrollbackLines: 10000,
    scrollbackMode: 'limited',
    outputThrottleMs: 16,
    rendererMode: 'auto',
    showFpsCounter: false,
};

interface ThemeContextType {
    theme: Theme;
    setTheme: (themeId: string) => void;
    terminalTheme: TerminalTheme;
    setTerminalTheme: (themeId: string) => void;
    terminalFont: TerminalFont;
    setTerminalFont: (font: Partial<TerminalFont>) => void;
    terminalCursorStyle: 'block' | 'underline' | 'bar';
    setTerminalCursorStyle: (style: 'block' | 'underline' | 'bar') => void;
    availableThemes: Theme[];
    availableTerminalThemes: TerminalTheme[];
    autoOpenMonitor: boolean;
    setAutoOpenMonitor: (open: boolean) => void;
    sessionTimeout: number;
    setSessionTimeout: (timeout: number) => void;
    terminalPerformance: TerminalPerformanceSettings;
    setTerminalPerformance: (settings: Partial<TerminalPerformanceSettings>) => void;
    dashboardQuickActions: string[];
    setDashboardQuickActions: (actions: string[]) => void;
    isLoading: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);

    const [theme, setThemeState] = useState<Theme>(themes.modernDark);
    const [terminalTheme, setTerminalThemeState] = useState<TerminalTheme>(terminalThemes.appTheme);
    const [terminalFont, setTerminalFontState] = useState<TerminalFont>(defaultTerminalFont);
    const [terminalCursorStyle, setTerminalCursorStyleState] = useState<'block' | 'underline' | 'bar'>('block');
    const [autoOpenMonitor, setAutoOpenMonitorState] = useState<boolean>(false);
    const [sessionTimeout, setSessionTimeoutState] = useState<number>(30);
    const [terminalPerformance, setTerminalPerformanceState] = useState<TerminalPerformanceSettings>(defaultPerformanceSettings);
    const [dashboardQuickActions, setDashboardQuickActionsState] = useState<string[]>(['new-connection', 'sharing', 'import', 'settings']);

    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            try {
                await checkAndMigrate();
                await storage.initialize();

                if (!mounted) return;

                const savedTheme = storage.getCached<string>('cliqon-theme', 'modernDark');
                if (savedTheme && themes[savedTheme]) {
                    setThemeState(themes[savedTheme]);
                }

                const savedTerminalTheme = storage.getCached<string>('cliqon-terminal-theme', 'appTheme');
                if (savedTerminalTheme && terminalThemes[savedTerminalTheme]) {
                    setTerminalThemeState(terminalThemes[savedTerminalTheme]);
                }

                const savedFont = storage.getCached<Partial<TerminalFont>>('cliqon-terminal-font', {});
                if (Object.keys(savedFont).length > 0) {
                    setTerminalFontState({ ...defaultTerminalFont, ...savedFont });
                }

                const savedCursor = storage.getCached<string>('cliqon-terminal-cursor', 'block');
                if (savedCursor === 'block' || savedCursor === 'underline' || savedCursor === 'bar') {
                    setTerminalCursorStyleState(savedCursor);
                }

                const savedAutoOpen = storage.getCached<string>('cliqon-auto-open-monitor', 'false');
                setAutoOpenMonitorState(savedAutoOpen === 'true');

                const savedTimeout = storage.getCached<string>('cliqon-session-timeout', '30');
                const parsed = parseInt(savedTimeout, 10);
                if (!isNaN(parsed)) {
                    setSessionTimeoutState(parsed);
                }

                const savedPerf = storage.getCached<Partial<TerminalPerformanceSettings>>('cliqon-terminal-performance', {});
                if (Object.keys(savedPerf).length > 0) {
                    setTerminalPerformanceState({ ...defaultPerformanceSettings, ...savedPerf });
                }

                const savedQuickActions = storage.getCached<string[]>('cliqon-dashboard-quick-actions', ['new-connection', 'sharing', 'import', 'settings']);
                setDashboardQuickActionsState(savedQuickActions);

            } catch (err) {
                console.error('Failed to initialize theme context:', err);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        initialize();

        return () => {
            mounted = false;
        };
    }, []);

    const setTheme = useCallback((themeId: string) => {
        if (themes[themeId]) {
            setThemeState(themes[themeId]);
            storage.set('cliqon-theme', themeId);
        }
    }, []);

    const setTerminalTheme = useCallback((themeId: string) => {
        if (terminalThemes[themeId]) {
            setTerminalThemeState(terminalThemes[themeId]);
            storage.set('cliqon-terminal-theme', themeId);
        }
    }, []);

    const setTerminalFont = useCallback((font: Partial<TerminalFont>) => {
        setTerminalFontState(prev => {
            const next = { ...prev, ...font };
            storage.set('cliqon-terminal-font', next);
            return next;
        });
    }, []);

    const setTerminalCursorStyle = useCallback((style: 'block' | 'underline' | 'bar') => {
        setTerminalCursorStyleState(style);
        storage.set('cliqon-terminal-cursor', style);
    }, []);

    const setAutoOpenMonitor = useCallback((open: boolean) => {
        setAutoOpenMonitorState(open);
        storage.set('cliqon-auto-open-monitor', String(open));
    }, []);

    const setSessionTimeout = useCallback((timeout: number) => {
        setSessionTimeoutState(timeout);
        storage.set('cliqon-session-timeout', String(timeout));
    }, []);

    const setTerminalPerformance = useCallback((settings: Partial<TerminalPerformanceSettings>) => {
        setTerminalPerformanceState(prev => {
            const next = { ...prev, ...settings };
            storage.set('cliqon-terminal-performance', next);
            return next;
        });
    }, []);

    const setDashboardQuickActions = useCallback((actions: string[]) => {
        setDashboardQuickActionsState(actions);
        storage.set('cliqon-dashboard-quick-actions', actions);
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const root = document.documentElement;
        root.setAttribute('data-theme', theme.id);

        root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
        root.style.setProperty('--bg-sidebar', theme.colors.bgSidebar);
        root.style.setProperty('--text-main', theme.colors.textMain);
        root.style.setProperty('--text-muted', theme.colors.textMuted);
        root.style.setProperty('--accent-color', theme.colors.accent);
        root.style.setProperty('--border-color', theme.colors.border);
        root.style.setProperty('--hover-color', theme.colors.hover);

        // Handle gradient themes
        if (theme.gradient) {
            root.style.setProperty('--gradient-from', theme.gradient.from);
            root.style.setProperty('--gradient-to', theme.gradient.to);
            root.style.setProperty('--gradient-direction', theme.gradient.direction || 'to bottom');

            // Apply gradient animation class based on animated property
            const body = document.body;
            if (theme.gradient.animated) {
                body.classList.add('gradient-animated');
            } else {
                body.classList.remove('gradient-animated');
            }
        } else {
            // Reset gradient variables for non-gradient themes
            root.style.setProperty('--gradient-from', 'transparent');
            root.style.setProperty('--gradient-to', 'transparent');
            document.body.classList.remove('gradient-animated');
        }

        if (theme.id === 'glassDark') {
            root.classList.add('theme-glass');
        } else {
            root.classList.remove('theme-glass');
        }
    }, [theme, isLoading]);

    return (
        <ThemeContext.Provider value={{
            theme,
            setTheme,
            terminalTheme,
            setTerminalTheme,
            terminalFont,
            setTerminalFont,
            terminalCursorStyle,
            setTerminalCursorStyle,
            availableThemes: Object.values(themes),
            availableTerminalThemes: Object.values(terminalThemes),
            autoOpenMonitor,
            setAutoOpenMonitor,
            sessionTimeout,
            setSessionTimeout,
            terminalPerformance,
            setTerminalPerformance,
            dashboardQuickActions,
            setDashboardQuickActions,
            isLoading
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
