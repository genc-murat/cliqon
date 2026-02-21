export interface Theme {
    id: string;
    name: string;
    type: 'dark' | 'light';
    colors: {
        bgPrimary: string;
        bgSidebar: string;
        textMain: string;
        textMuted: string;
        accent: string;
        border: string;
        hover: string;
    };
}

export const themes: Record<string, Theme> = {
    modernDark: {
        id: 'modernDark',
        name: 'Modern Dark',
        type: 'dark',
        colors: {
            bgPrimary: '#09090b', // Zinc 950
            bgSidebar: '#18181b', // Zinc 900
            textMain: '#fafafa',  // Zinc 50
            textMuted: '#a1a1aa', // Zinc 400
            accent: '#3b82f6',    // Blue 500
            border: '#27272a',    // Zinc 800
            hover: '#27272a',     // Zinc 800
        }
    },
    glassDark: {
        id: 'glassDark',
        name: 'Glass Dark',
        type: 'dark',
        colors: {
            bgPrimary: '#0f172a', // Slate 900
            bgSidebar: 'rgba(15, 23, 42, 0.6)',
            textMain: '#f8fafc',  // Slate 50
            textMuted: '#94a3b8', // Slate 400
            accent: '#6366f1',    // Indigo 500
            border: 'rgba(51, 65, 85, 0.4)', // Slate 700 Alpha
            hover: 'rgba(51, 65, 85, 0.4)',  // Slate 700 Alpha
        }
    },
    modernLight: {
        id: 'modernLight',
        name: 'Modern Light',
        type: 'light',
        colors: {
            bgPrimary: '#ffffff', // White
            bgSidebar: '#f4f4f5', // Zinc 100
            textMain: '#18181b',  // Zinc 900
            textMuted: '#71717a', // Zinc 500
            accent: '#2563eb',    // Blue 600
            border: '#e4e4e7',    // Zinc 200
            hover: '#e4e4e7',     // Zinc 200
        }
    }
};

export interface TerminalTheme {
    id: string;
    name: string;
    colors: {
        background?: string;
        foreground?: string;
        cursor?: string;
        selectionBackground?: string;
        black: string;
        red: string;
        green: string;
        yellow: string;
        blue: string;
        magenta: string;
        cyan: string;
        white: string;
        brightBlack: string;
        brightRed: string;
        brightGreen: string;
        brightYellow: string;
        brightBlue: string;
        brightMagenta: string;
        brightCyan: string;
        brightWhite: string;
    };
}

export const terminalThemes: Record<string, TerminalTheme> = {
    appTheme: {
        id: 'appTheme',
        name: 'Match App Theme',
        colors: {
            // These background/foreground values will be dynamically overridden by the app theme in TerminalViewer
            black: '#000000', red: '#cd3131', green: '#0bc261', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
            brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5',
        }
    },
    ubuntu: {
        id: 'ubuntu',
        name: 'Ubuntu',
        colors: {
            background: '#300a24',
            foreground: '#eeeeee',
            cursor: '#eeeeee',
            selectionBackground: '#b5d5ff50',
            black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf',
            brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f', brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec',
        }
    },
    campbell: {
        id: 'campbell',
        name: 'Campbell (CMD)',
        colors: {
            background: '#0c0c0c',
            foreground: '#cccccc',
            cursor: '#ffffff',
            selectionBackground: '#ffffff40',
            black: '#0c0c0c', red: '#c50f1f', green: '#13a10e', yellow: '#c19c00', blue: '#0037da', magenta: '#881798', cyan: '#3a96dd', white: '#cccccc',
            brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c', brightYellow: '#f9f1a5', brightBlue: '#3b78ff', brightMagenta: '#b4009e', brightCyan: '#61d6d6', brightWhite: '#f2f2f2',
        }
    },
    dracula: {
        id: 'dracula',
        name: 'Dracula',
        colors: {
            background: '#282a36',
            foreground: '#f8f8f2',
            cursor: '#f8f8f2',
            selectionBackground: '#44475a',
            black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
            brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
        }
    },
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        colors: {
            background: '#0f0f23',
            foreground: '#ff003c',
            cursor: '#e2f700',
            selectionBackground: '#00fff540',
            black: '#000000', red: '#ff003c', green: '#00ff00', yellow: '#e2f700', blue: '#0055ff', magenta: '#ff00ff', cyan: '#00fff5', white: '#ffffff',
            brightBlack: '#555555', brightRed: '#ff4444', brightGreen: '#55ff55', brightYellow: '#ffff55', brightBlue: '#5555ff', brightMagenta: '#ff55ff', brightCyan: '#55ffff', brightWhite: '#ffffff',
        }
    }
};

export interface TerminalFont {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
}

export const defaultTerminalFont: TerminalFont = {
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: 14,
    lineHeight: 1.2,
};

export const terminalFontFamilies: { id: string; name: string; value: string }[] = [
    { id: 'jetbrains', name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    { id: 'fira', name: 'Fira Code', value: "'Fira Code', monospace" },
    { id: 'cascadia', name: 'Cascadia Code', value: "'Cascadia Code', monospace" },
    { id: 'consolas', name: 'Consolas', value: 'Consolas, monospace' },
    { id: 'courier', name: 'Courier New', value: "'Courier New', monospace" },
    { id: 'ubuntu', name: 'Ubuntu Mono', value: "'Ubuntu Mono', monospace" },
    { id: 'monaco', name: 'Monaco', value: 'Monaco, monospace' },
    { id: 'sourcecodepro', name: 'Source Code Pro', value: "'Source Code Pro', monospace" },
];
