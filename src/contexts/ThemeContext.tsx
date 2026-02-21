import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Theme, themes, TerminalTheme, terminalThemes, TerminalFont, defaultTerminalFont } from '../lib/themes';

interface ThemeContextType {
    theme: Theme;
    setTheme: (themeId: string) => void;
    terminalTheme: TerminalTheme;
    setTerminalTheme: (themeId: string) => void;
    terminalFont: TerminalFont;
    setTerminalFont: (font: Partial<TerminalFont>) => void;
    availableThemes: Theme[];
    availableTerminalThemes: TerminalTheme[];
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('cliqon-theme');
        if (saved && themes[saved]) {
            return themes[saved];
        }
        return themes.modernDark;
    });

    const [terminalTheme, setTerminalThemeState] = useState<TerminalTheme>(() => {
        const saved = localStorage.getItem('cliqon-terminal-theme');
        if (saved && terminalThemes[saved]) {
            return terminalThemes[saved];
        }
        return terminalThemes.appTheme;
    });

    const [terminalFont, setTerminalFontState] = useState<TerminalFont>(() => {
        try {
            const saved = localStorage.getItem('cliqon-terminal-font');
            if (saved) return { ...defaultTerminalFont, ...JSON.parse(saved) };
        } catch { }
        return defaultTerminalFont;
    });

    const setTheme = (themeId: string) => {
        if (themes[themeId]) {
            setThemeState(themes[themeId]);
            localStorage.setItem('cliqon-theme', themeId);
        }
    };

    const setTerminalTheme = (themeId: string) => {
        if (terminalThemes[themeId]) {
            setTerminalThemeState(terminalThemes[themeId]);
            localStorage.setItem('cliqon-terminal-theme', themeId);
        }
    };

    const setTerminalFont = (font: Partial<TerminalFont>) => {
        setTerminalFontState(prev => {
            const next = { ...prev, ...font };
            localStorage.setItem('cliqon-terminal-font', JSON.stringify(next));
            return next;
        });
    };

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme.type);

        root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
        root.style.setProperty('--bg-sidebar', theme.colors.bgSidebar);
        root.style.setProperty('--text-main', theme.colors.textMain);
        root.style.setProperty('--text-muted', theme.colors.textMuted);
        root.style.setProperty('--accent-color', theme.colors.accent);
        root.style.setProperty('--border-color', theme.colors.border);
        root.style.setProperty('--hover-color', theme.colors.hover);

        if (theme.id === 'glassDark') {
            root.classList.add('theme-glass');
        } else {
            root.classList.remove('theme-glass');
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{
            theme,
            setTheme,
            terminalTheme,
            setTerminalTheme,
            terminalFont,
            setTerminalFont,
            availableThemes: Object.values(themes),
            availableTerminalThemes: Object.values(terminalThemes)
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
