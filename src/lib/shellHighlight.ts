import type { IMarker, Terminal } from '@xterm/xterm';

export interface ShellInputLine {
    row: number;
    startColumn: number;
    text: string;
}

export function readShellInput(terminal: Terminal, startRow: number, startColumn: number): ShellInputLine[] {
    const buffer = terminal.buffer.active;
    const lines: ShellInputLine[] = [];
    for (let row = startRow; row < buffer.length && row < startRow + terminal.rows; row++) {
        const line = buffer.getLine(row);
        if (!line || (row > startRow && !line.isWrapped)) break;
        const column = row === startRow ? startColumn : 0;
        const continues = buffer.getLine(row + 1)?.isWrapped;
        lines.push({
            row,
            startColumn: column,
            text: line.translateToString(!continues, column, terminal.cols),
        });
    }
    return lines;
}

type TokenKind = 'command' | 'option' | 'string' | 'variable' | 'operator' | 'comment';

const palettes: Record<'light' | 'dark', Record<TokenKind, string>> = {
    light: {
        command: '#005F87',
        option: '#854600',
        string: '#286327',
        variable: '#7135A2',
        operator: '#9E294A',
        comment: '#536378',
    },
    dark: {
        command: '#7DD3FC',
        option: '#FBBF75',
        string: '#A7DB91',
        variable: '#D8B4FE',
        operator: '#FDA4AF',
        comment: '#9EACC0',
    },
};

const shellTokens = /"(?:\\[\s\S]|[^"\\])*"?|'[^']*'?|\$(?:\{[^}]*\}?|[A-Za-z_]\w*|[0-9?!#$*@-])|&&|\|\||>>|<<|[|;&<>()]|(?:\\[\s\S]|[^\s"'$|;&<>()])+/g;

export function tokenizeShellInput(text: string) {
    const highlights: { start: number; end: number; kind: TokenKind }[] = [];
    let expectCommand = true;
    for (const match of text.matchAll(shellTokens)) {
        const token = match[0];
        const start = match.index!;
        let kind: TokenKind | undefined;
        if (token.startsWith('#') && (start === 0 || /[\s;|&()]/.test(text[start - 1]))) {
            highlights.push({ start, end: text.length, kind: 'comment' });
            break;
        } else if (/^[|;&<>()]/.test(token)) {
            kind = 'operator';
            expectCommand = /^[|;&(]/.test(token);
        } else if (/^['"]/.test(token)) {
            kind = 'string';
        } else if (/^\$./.test(token)) {
            kind = 'variable';
        } else if (/^--?\w/.test(token)) {
            kind = 'option';
        } else if (/^[A-Za-z_]\w*=/.test(token)) {
            kind = 'variable';
        } else if (expectCommand) {
            kind = 'command';
            expectCommand = false;
        }
        if (kind) highlights.push({ start, end: start + token.length, kind });
    }
    return highlights;
}

function paletteFor(background?: string) {
    if (!background || !/^#[\da-f]{6}$/i.test(background)) return palettes.dark;
    const [red, green, blue] = background.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
    return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 145 ? palettes.light : palettes.dark;
}

interface ColorSpan {
    column: number;
    width: number;
    color: string;
}

interface InputDecorations {
    markers: IMarker[];
    signature: string;
}

function clearDecorations(decorations: InputDecorations) {
    for (const marker of decorations.markers) marker.dispose();
    decorations.markers = [];
    decorations.signature = '';
}

export function highlightShellInput(terminal: Terminal) {
    let live: InputDecorations = { markers: [], signature: '' };
    let submitted: {
        anchor: IMarker;
        startColumn: number;
        prompt: string;
        decorations: InputDecorations;
    } | undefined;

    const readPrompt = (input: ShellInputLine | undefined) => {
        const buffer = terminal.buffer.active;
        if (!input || buffer.type !== 'normal') return undefined;
        const prompt = buffer.getLine(input.row)?.translateToString(true, 0, input.startColumn);
        return prompt && /[$#%>❯➜λ›»]$/u.test(prompt.trimEnd()) ? prompt : undefined;
    };

    const paint = (lines: ShellInputLine[], decorations: InputDecorations) => {
        const buffer = terminal.buffer.active;
        const tokens = tokenizeShellInput(lines.map(line => line.text).join(''));
        const colors = paletteFor(terminal.options.theme?.background);
        const cell = buffer.getNullCell();
        const decoratedRows: { row: number; spans: ColorSpan[] }[] = [];
        let offset = 0;
        let tokenIndex = 0;

        for (const input of lines) {
            const line = buffer.getLine(input.row);
            if (!line) break;
            const end = offset + input.text.length;
            const spans: ColorSpan[] = [];

            for (let column = input.startColumn; column < terminal.cols && offset < end; column++) {
                if (!line.getCell(column, cell)) break;
                const width = cell.getWidth();
                if (width === 0) continue;
                while (tokenIndex < tokens.length && tokens[tokenIndex].end <= offset) tokenIndex++;
                const token = tokens[tokenIndex];
                const kind = token && token.start <= offset && cell.isFgDefault() && !cell.isInverse()
                    ? token.kind : undefined;
                if (kind) {
                    const color = colors[kind];
                    const previous = spans[spans.length - 1];
                    if (previous?.color === color && previous.column + previous.width === column) {
                        previous.width += width;
                    } else {
                        spans.push({ column, width, color });
                    }
                }
                offset += (cell.getChars() || ' ').length;
            }
            if (spans.length) decoratedRows.push({ row: input.row, spans });
            offset = end;
        }

        const signature = JSON.stringify(decoratedRows);
        if (signature === decorations.signature && decorations.markers.every(marker => !marker.isDisposed)) return;
        clearDecorations(decorations);
        decorations.signature = signature;

        const cursorRow = buffer.baseY + buffer.cursorY;
        for (const { row, spans } of decoratedRows) {
            const marker = terminal.registerMarker(row - cursorRow);
            if (!marker) continue;
            decorations.markers.push(marker);
            for (const { column, width, color } of spans) {
                terminal.registerDecoration({ marker, x: column, width, foregroundColor: color });
            }
        }
    };

    const finishSubmission = () => {
        submitted?.anchor.dispose();
        // xterm keeps the decoration markers until their lines leave scrollback.
        submitted = undefined;
    };

    return {
        update(lines: ShellInputLine[] | null) {
            const buffer = terminal.buffer.active;
            if (submitted && buffer.type === 'normal') {
                const { anchor, startColumn, prompt, decorations } = submitted;
                const echoed = anchor.isDisposed ? [] : readShellInput(terminal, anchor.line, startColumn);
                if (readPrompt(echoed[0]) !== prompt) {
                    clearDecorations(decorations);
                    finishSubmission();
                } else {
                    paint(echoed, decorations);
                    if (!echoed.some(line => line.row === buffer.baseY + buffer.cursorY)) finishSubmission();
                }
            }
            if (lines && readPrompt(lines[0])) paint(lines, live);
            else clearDecorations(live);
        },
        submit(lines: ShellInputLine[] | null) {
            const first = lines?.[0];
            const prompt = readPrompt(first);
            if (!lines || !first || !prompt) {
                clearDecorations(live);
                return;
            }

            const buffer = terminal.buffer.active;
            const cursorRow = buffer.baseY + buffer.cursorY;
            if (submitted?.anchor.line === first.row && submitted.startColumn === first.startColumn) {
                clearDecorations(live);
                return;
            }
            finishSubmission();
            paint(lines, live);
            const anchor = terminal.registerMarker(first.row - cursorRow);
            if (anchor) {
                // The server can echo the last keystrokes after Enter is sent.
                submitted = { anchor, startColumn: first.startColumn, prompt, decorations: live };
                live = { markers: [], signature: '' };
            }
        },
        clear() {
            clearDecorations(live);
        },
        dispose() {
            clearDecorations(live);
            finishSubmission();
        },
    };
}
