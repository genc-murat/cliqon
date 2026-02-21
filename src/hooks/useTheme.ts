import { useState, useEffect } from 'react';
import { Theme, themes, TerminalTheme, terminalThemes } from '../lib/themes';

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(() => {
        // Try to restore theme from local storage
        const saved = localStorage.getItem('cliqon-theme');
        if (saved && themes[saved]) {
            return themes[saved];
        }
        // Default to modernDark
        return themes.modernDark;
    });

    const [terminalTheme, setTerminalThemeState] = useState<TerminalTheme>(() => {
        const saved = localStorage.getItem('cliqon-terminal-theme');
        if (saved && terminalThemes[saved]) {
            return terminalThemes[saved];
        }
        return terminalThemes.appTheme;
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

    useEffect(() => {
        // Apply CSS variables to root element
        const root = document.documentElement;
        root.setAttribute('data-theme', theme.type);

        root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
        root.style.setProperty('--bg-sidebar', theme.colors.bgSidebar);
        root.style.setProperty('--text-main', theme.colors.textMain);
        root.style.setProperty('--text-muted', theme.colors.textMuted);
        root.style.setProperty('--accent-color', theme.colors.accent);
        root.style.setProperty('--border-color', theme.colors.border);
        root.style.setProperty('--hover-color', theme.colors.hover);

        // Apply specific classes based on theme for global styles
        if (theme.id === 'glassDark') {
            root.classList.add('theme-glass');
        } else {
            root.classList.remove('theme-glass');
        }

    }, [theme]);

    return {
        theme,
        setTheme,
        terminalTheme,
        setTerminalTheme,
        availableThemes: Object.values(themes),
        availableTerminalThemes: Object.values(terminalThemes)
    };
}
