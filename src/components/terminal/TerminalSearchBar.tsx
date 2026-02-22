import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown, Replace, CaseSensitive, Regex } from 'lucide-react';
import type { SearchAddon } from '@xterm/addon-search';

interface TerminalSearchBarProps {
    searchAddon: SearchAddon | null;
    onClose: () => void;
}

export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({ searchAddon, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [matchCount, setMatchCount] = useState<{ current: number; total: number } | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    const getSearchOptions = useCallback(() => ({
        caseSensitive,
        regex: useRegex,
        incremental: true,
    }), [caseSensitive, useRegex]);

    const doSearch = useCallback((direction: 'next' | 'prev' = 'next') => {
        if (!searchAddon || !searchTerm) {
            setMatchCount(null);
            return;
        }
        const found = direction === 'next'
            ? searchAddon.findNext(searchTerm, getSearchOptions())
            : searchAddon.findPrevious(searchTerm, getSearchOptions());
        // xterm search addon doesn't provide match counts, so we track basic state
        if (found) {
            setMatchCount(prev => prev ? { ...prev, current: direction === 'next' ? prev.current + 1 : prev.current - 1 } : { current: 1, total: 0 });
        } else {
            setMatchCount({ current: 0, total: 0 });
        }
    }, [searchAddon, searchTerm, getSearchOptions]);

    // Search on input change
    useEffect(() => {
        if (!searchAddon) return;
        if (searchTerm) {
            searchAddon.findNext(searchTerm, getSearchOptions());
        } else {
            searchAddon.clearDecorations();
            setMatchCount(null);
        }
    }, [searchTerm, caseSensitive, useRegex, searchAddon, getSearchOptions]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            searchAddon?.clearDecorations();
            onClose();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                doSearch('prev');
            } else {
                doSearch('next');
            }
        }
    };

    return (
        <div
            className="absolute top-2 right-4 z-30 flex flex-col gap-1.5 p-2.5 rounded-lg shadow-2xl border animate-in slide-in-from-top-2 duration-200"
            style={{
                background: 'var(--bg-sidebar)',
                borderColor: 'var(--border-color)',
                minWidth: 340,
                backdropFilter: 'blur(12px)',
            }}
            onKeyDown={handleKeyDown}
        >
            {/* Search Row */}
            <div className="flex items-center gap-1.5">
                <Search size={14} className="text-[var(--text-muted)] shrink-0" />
                <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Ara..."
                    className="flex-1 bg-[var(--bg-primary)] text-[var(--text-main)] text-xs px-2 py-1.5 rounded border border-[var(--border-color)] outline-none focus:border-[var(--accent-color)] transition-colors"
                    style={{ minWidth: 0 }}
                />
                {matchCount && (
                    <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap shrink-0 tabular-nums">
                        {matchCount.current > 0 ? `${matchCount.current}` : 'Sonuç yok'}
                    </span>
                )}

                {/* Toggle buttons */}
                <button
                    onClick={() => setCaseSensitive(v => !v)}
                    className={`p-1 rounded transition-colors ${caseSensitive ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
                    title="Büyük/Küçük Harf Duyarlı"
                >
                    <CaseSensitive size={14} />
                </button>
                <button
                    onClick={() => setUseRegex(v => !v)}
                    className={`p-1 rounded transition-colors ${useRegex ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
                    title="Regex"
                >
                    <Regex size={14} />
                </button>

                {/* Navigation */}
                <button onClick={() => doSearch('prev')} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--hover-bg)] transition-colors" title="Önceki (Shift+Enter)">
                    <ChevronUp size={14} />
                </button>
                <button onClick={() => doSearch('next')} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--hover-bg)] transition-colors" title="Sonraki (Enter)">
                    <ChevronDown size={14} />
                </button>

                {/* Toggle replace */}
                <button
                    onClick={() => setShowReplace(v => !v)}
                    className={`p-1 rounded transition-colors ${showReplace ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
                    title="Bul ve Değiştir"
                >
                    <Replace size={14} />
                </button>

                <button onClick={() => { searchAddon?.clearDecorations(); onClose(); }} className="p-1 rounded text-[var(--text-muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Kapat (Esc)">
                    <X size={14} />
                </button>
            </div>

            {/* Replace Row */}
            {showReplace && (
                <div className="flex items-center gap-1.5 pl-5">
                    <input
                        type="text"
                        value={replaceTerm}
                        onChange={e => setReplaceTerm(e.target.value)}
                        placeholder="Değiştir..."
                        className="flex-1 bg-[var(--bg-primary)] text-[var(--text-main)] text-xs px-2 py-1.5 rounded border border-[var(--border-color)] outline-none focus:border-[var(--accent-color)] transition-colors"
                    />
                    <span className="text-[10px] text-[var(--text-dimmed)] italic">
                        Terminal'de değiştirme yapılamaz
                    </span>
                </div>
            )}
        </div>
    );
};
