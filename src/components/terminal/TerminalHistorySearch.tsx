import React, { useState, useRef, useEffect, useCallback } from 'react';
import { History, Search, X } from 'lucide-react';
import { CommandPredictor } from '../../ml/CommandPredictor';

interface TerminalHistorySearchProps {
    predictor: CommandPredictor;
    onSelect: (command: string) => void;
    onClose: () => void;
}

export const TerminalHistorySearch: React.FC<TerminalHistorySearchProps> = ({ predictor, onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        // Show all history initially sorted by recency
        setResults(predictor.getAllHistory());
    }, [predictor]);

    useEffect(() => {
        if (query.trim()) {
            setResults(predictor.searchHistory(query, 20));
        } else {
            setResults(predictor.getAllHistory());
        }
        setSelectedIndex(0);
    }, [query, predictor]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
            case 'Enter':
                e.preventDefault();
                if (results.length > 0 && results[selectedIndex]) {
                    onSelect(results[selectedIndex]);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(0, prev - 1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(results.length - 1, prev + 1));
                break;
            case 'Tab':
                e.preventDefault();
                if (results.length > 0 && results[selectedIndex]) {
                    onSelect(results[selectedIndex]);
                }
                break;
        }
    }, [results, selectedIndex, onSelect, onClose]);

    const highlightMatch = (text: string, q: string) => {
        if (!q.trim()) return text;
        const idx = text.toLowerCase().indexOf(q.toLowerCase());
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <span className="text-[var(--accent-color)] font-semibold">{text.slice(idx, idx + q.length)}</span>
                {text.slice(idx + q.length)}
            </>
        );
    };

    return (
        <div
            className="absolute bottom-0 left-0 right-0 z-30 border-t animate-in slide-in-from-bottom-2 duration-200"
            style={{
                background: 'var(--bg-sidebar)',
                borderColor: 'var(--border-color)',
                maxHeight: '50%',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Results List */}
            {results.length > 0 && (
                <div
                    className="flex-1 overflow-y-auto"
                    style={{ maxHeight: 200 }}
                >
                    {results.map((cmd, i) => (
                        <div
                            key={i}
                            className={`px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors truncate flex items-center gap-2
                                ${i === selectedIndex
                                    ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)]'
                                    : 'text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
                                }`}
                            onClick={() => onSelect(cmd)}
                            onMouseEnter={() => setSelectedIndex(i)}
                        >
                            <History size={11} className="shrink-0 opacity-40" />
                            <span className="truncate">{highlightMatch(cmd, query)}</span>
                        </div>
                    ))}
                </div>
            )}

            {results.length === 0 && query && (
                <div className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">
                    Sonuç bulunamadı
                </div>
            )}

            {/* Search Input */}
            <div
                className="flex items-center gap-2 px-3 py-2 border-t shrink-0"
                style={{ borderColor: 'var(--border-color)' }}
            >
                <Search size={13} className="text-[var(--accent-color)] shrink-0" />
                <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">(reverse-i-search)</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Komut ara..."
                    className="flex-1 bg-transparent text-[var(--text-main)] text-xs font-mono outline-none border-none"
                />
                <span className="text-[10px] text-[var(--text-dimmed)] shrink-0">
                    {results.length > 0 ? `${selectedIndex + 1}/${results.length}` : ''}
                </span>
                <button
                    onClick={onClose}
                    className="p-1 rounded text-[var(--text-muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Kapat (Esc)"
                >
                    <X size={12} />
                </button>
            </div>
        </div>
    );
};
