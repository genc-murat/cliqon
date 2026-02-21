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
    },
    nordicNight: {
        id: 'nordicNight',
        name: 'Nordic Night',
        type: 'dark',
        colors: {
            bgPrimary: '#2e3440',
            bgSidebar: '#242933',
            textMain: '#eceff4',
            textMuted: '#d8dee9',
            accent: '#88c0d0',
            border: '#3b4252',
            hover: '#434c5e',
        }
    },
    midnightPurple: {
        id: 'midnightPurple',
        name: 'Midnight Purple',
        type: 'dark',
        colors: {
            bgPrimary: '#0f0a1f',
            bgSidebar: '#17112b',
            textMain: '#f3f0ff',
            textMuted: '#b197fc',
            accent: '#9775fa',
            border: '#2a1f4d',
            hover: '#3b2d66',
        }
    },
    emeraldForest: {
        id: 'emeraldForest',
        name: 'Emerald Forest',
        type: 'dark',
        colors: {
            bgPrimary: '#020d08',
            bgSidebar: '#04160e',
            textMain: '#ecfdf5',
            textMuted: '#6ee7b7',
            accent: '#10b981',
            border: '#064e3b',
            hover: '#065f46',
        }
    },
    cyberRose: {
        id: 'cyberRose',
        name: 'Cyber Rose',
        type: 'dark',
        colors: {
            bgPrimary: '#0d0221',
            bgSidebar: '#190a3b',
            textMain: '#fff0f6',
            textMuted: '#f783ac',
            accent: '#f06595',
            border: '#49065e',
            hover: '#5c0878',
        }
    },
    solarizedDark: {
        id: 'solarizedDark',
        name: 'Solarized Dark',
        type: 'dark',
        colors: {
            bgPrimary: '#002b36',
            bgSidebar: '#073642',
            textMain: '#eee8d5',
            textMuted: '#93a1a1',
            accent: '#268bd2',
            border: '#073642',
            hover: '#586e75',
        }
    },
    solarizedLight: {
        id: 'solarizedLight',
        name: 'Solarized Light',
        type: 'light',
        colors: {
            bgPrimary: '#fdf6e3',
            bgSidebar: '#eee8d5',
            textMain: '#657b83',
            textMuted: '#586e75',
            accent: '#2aa198',
            border: '#eee8d5',
            hover: '#93a1a1',
        }
    },
    synthwave: {
        id: 'synthwave',
        name: 'Synthwave',
        type: 'dark',
        colors: {
            bgPrimary: '#2b213a',
            bgSidebar: '#241b30',
            textMain: '#ffffff',
            textMuted: '#8d7da5',
            accent: '#f92aad',
            border: '#44355b',
            hover: '#3a2d4c',
        }
    },
    deepSea: {
        id: 'deepSea',
        name: 'Deep Sea',
        type: 'dark',
        colors: {
            bgPrimary: '#0a192f',
            bgSidebar: '#172a45',
            textMain: '#ccd6f6',
            textMuted: '#8892b0',
            accent: '#64ffda',
            border: '#233554',
            hover: '#303c55',
        }
    },
    matrix: {
        id: 'matrix',
        name: 'Matrix',
        type: 'dark',
        colors: {
            bgPrimary: '#000000',
            bgSidebar: '#000800',
            textMain: '#00ff41',
            textMuted: '#008f11',
            accent: '#00ff41',
            border: '#003b00',
            hover: '#001a00',
        }
    },
    autumn: {
        id: 'autumn',
        name: 'Autumn Leaves',
        type: 'dark',
        colors: {
            bgPrimary: '#2b1b17',
            bgSidebar: '#3d2b1f',
            textMain: '#e2725b',
            textMuted: '#b87333',
            accent: '#ff8c00',
            border: '#4a2c2a',
            hover: '#5c3a21',
        }
    },
    latte: {
        id: 'latte',
        name: 'Creamy Latte',
        type: 'light',
        colors: {
            bgPrimary: '#f5f5f0',
            bgSidebar: '#edeae0',
            textMain: '#4a3728',
            textMuted: '#8b7355',
            accent: '#c0a080',
            border: '#dcd9cd',
            hover: '#e5e2d6',
        }
    },
    roseGold: {
        id: 'roseGold',
        name: 'Rose Gold',
        type: 'light',
        colors: {
            bgPrimary: '#fffafa',
            bgSidebar: '#fff0f5',
            textMain: '#3d2b2b',
            textMuted: '#a0522d',
            accent: '#e0115f',
            border: '#ffe4e1',
            hover: '#fdf5e6',
        }
    },
    oceanBreeze: {
        id: 'oceanBreeze',
        name: 'Ocean Breeze',
        type: 'light',
        colors: {
            bgPrimary: '#f0f8ff',
            bgSidebar: '#e6f3ff',
            textMain: '#003366',
            textMuted: '#4682b4',
            accent: '#00bfff',
            border: '#b0c4de',
            hover: '#add8e6',
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
            black: '#000000', red: '#cd3131', green: '#0bc261', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
            brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5',
        }
    },
    tokyoNight: {
        id: 'tokyoNight',
        name: 'Tokyo Night',
        colors: {
            background: '#1a1b26', foreground: '#a9b1d6', cursor: '#c0caf5', selectionBackground: '#33467c',
            black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
            brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5',
        }
    },
    oneDark: {
        id: 'oneDark',
        name: 'One Dark',
        colors: {
            background: '#282c34', foreground: '#abb2bf', cursor: '#528bff', selectionBackground: '#3e4451',
            black: '#282c34', red: '#e06c75', green: '#98c379', yellow: '#d19a66', blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#abb2bf',
            brightBlack: '#5c6370', brightRed: '#e06c75', brightGreen: '#98c379', brightYellow: '#d19a66', brightBlue: '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#ffffff',
        }
    },
    ayuMirage: {
        id: 'ayuMirage',
        name: 'Ayu Mirage',
        colors: {
            background: '#212733', foreground: '#d9d7ce', cursor: '#ffcc66', selectionBackground: '#343f4c',
            black: '#191e2a', red: '#ed8274', green: '#a6cc70', yellow: '#fad07b', blue: '#6dcbfa', magenta: '#cfbafa', cyan: '#90e1c6', white: '#c7c7c7',
            brightBlack: '#686868', brightRed: '#f28779', brightGreen: '#bae67e', brightYellow: '#ffd580', brightBlue: '#73d0ff', brightMagenta: '#d4bfff', brightCyan: '#95e6cb', brightWhite: '#ffffff',
        }
    },
    monokai: {
        id: 'monokai',
        name: 'Monokai',
        colors: {
            background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f2', selectionBackground: '#49483e',
            black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75', blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
            brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e', brightYellow: '#f4bf75', brightBlue: '#66d9ef', brightMagenta: '#ae81ff', brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
        }
    },
    everforest: {
        id: 'everforest',
        name: 'Everforest',
        colors: {
            background: '#2b3339', foreground: '#d3c6aa', cursor: '#d3c6aa', selectionBackground: '#424a4e',
            black: '#4b565c', red: '#e67e80', green: '#a7c080', yellow: '#dbbc7f', blue: '#7fbbb3', magenta: '#d699b6', cyan: '#83c092', white: '#d3c6aa',
            brightBlack: '#4b565c', brightRed: '#e67e80', brightGreen: '#a7c080', brightYellow: '#dbbc7f', brightBlue: '#7fbbb3', brightMagenta: '#d699b6', brightCyan: '#83c092', brightWhite: '#d3c6aa',
        }
    },
    nord: {
        id: 'nord',
        name: 'Nord',
        colors: {
            background: '#2e3440', foreground: '#d8dee9', cursor: '#d8dee9', selectionBackground: '#434c5e',
            black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
            brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4',
        }
    },
    solarizedDark: {
        id: 'solarizedDark',
        name: 'Solarized Dark',
        colors: {
            background: '#002b36', foreground: '#839496', cursor: '#839496', selectionBackground: '#073642',
            black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
            brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
        }
    },
    solarizedLight: {
        id: 'solarizedLight',
        name: 'Solarized Light',
        colors: {
            background: '#fdf6e3', foreground: '#657b83', cursor: '#657b83', selectionBackground: '#eee8d5',
            black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
            brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
        }
    },
    gruvboxDark: {
        id: 'gruvboxDark',
        name: 'Gruvbox',
        colors: {
            background: '#282828', foreground: '#ebdbb2', cursor: '#ebdbb2', selectionBackground: '#504945',
            black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984',
            brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2',
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
    },
    synthwave: {
        id: 'synthwave',
        name: 'Synthwave Neon',
        colors: {
            background: '#2b213a',
            foreground: '#ffffff',
            cursor: '#f92aad',
            selectionBackground: '#ffffff20',
            black: '#1b1b1b', red: '#fe4450', green: '#72f1b8', yellow: '#fede5d', blue: '#03edf9', magenta: '#f92aad', cyan: '#03edf9', white: '#ffffff',
            brightBlack: '#666666', brightRed: '#fe4450', brightGreen: '#72f1b8', brightYellow: '#fede5d', brightBlue: '#03edf9', brightMagenta: '#f92aad', brightCyan: '#03edf9', brightWhite: '#ffffff',
        }
    },
    matrix: {
        id: 'matrix',
        name: 'The Matrix',
        colors: {
            background: '#000000',
            foreground: '#00ff41',
            cursor: '#00ff41',
            selectionBackground: '#00ff4130',
            black: '#000000', red: '#003b00', green: '#00ff41', yellow: '#008f11', blue: '#003b00', magenta: '#00ff41', cyan: '#008f11', white: '#00ff41',
            brightBlack: '#003b00', brightRed: '#00ff41', brightGreen: '#00ff41', brightYellow: '#00ff41', brightBlue: '#003b00', brightMagenta: '#00ff41', brightCyan: '#00ff41', brightWhite: '#ffffff',
        }
    },
    deepSea: {
        id: 'deepSea',
        name: 'Deep Sea',
        colors: {
            background: '#0a192f',
            foreground: '#8892b0',
            cursor: '#64ffda',
            selectionBackground: '#233554',
            black: '#0a192f', red: '#f74c4c', green: '#64ffda', yellow: '#ccd6f6', blue: '#1d2d50', magenta: '#b388ff', cyan: '#00bcd4', white: '#ffffff',
            brightBlack: '#1d2d50', brightRed: '#f74c4c', brightGreen: '#a5ffd6', brightYellow: '#ccd6f6', brightBlue: '#1d2d50', brightMagenta: '#b388ff', brightCyan: '#00bcd4', brightWhite: '#ffffff',
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
