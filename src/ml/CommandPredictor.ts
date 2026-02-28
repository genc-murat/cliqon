import { TERMINAL_COMMANDS, COMMAND_SEQUENCES } from '../data/terminalCommands';

export interface Suggestion {
    command: string;
    score: number;
    source: 'history' | 'markov' | 'dictionary';
}

interface CommandEntry {
    command: string;
    count: number;
    lastUsed: number; // timestamp
}

interface MarkovTransition {
    next: string;
    count: number;
}

interface ModelData {
    history: CommandEntry[];
    markov: Record<string, MarkovTransition[]>;
    ngrams: Record<string, number>; // character-level ngram → count
    version: number;
}

const MODEL_VERSION = 1;
const MAX_HISTORY = 500;
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const MAX_SUGGESTIONS = 5;

/**
 * ML-powered command predictor using Markov chains + N-gram analysis + Frecency scoring.
 * Runs entirely client-side — no data leaves the user's machine.
 */
export class CommandPredictor {
    private history: Map<string, CommandEntry> = new Map();
    private markov: Map<string, MarkovTransition[]> = new Map();
    private ngrams: Map<string, number> = new Map();
    private lastCommand: string | null = null;
    private userSnippets: string[] = [];

    constructor() {
        this.bootstrapFromDictionary();
    }

    /**
     * Update the predictor with user-defined snippets.
     */
    setSnippets(snippets: string[]): void {
        this.userSnippets = snippets;
    }

    /**
     * Bootstrap the Markov model with known command sequences.
     */
    private bootstrapFromDictionary(): void {
        for (const [from, to] of COMMAND_SEQUENCES) {
            this.addMarkovTransition(from, to, 1);
        }
    }

    /**
     * Learn from a newly executed command.
     */
    learn(command: string): void {
        const trimmed = command.trim();
        if (!trimmed || trimmed.length < 2) return;

        const now = Date.now();

        // Update command history with frecency
        const existing = this.history.get(trimmed);
        if (existing) {
            existing.count += 1;
            existing.lastUsed = now;
        } else {
            this.history.set(trimmed, { command: trimmed, count: 1, lastUsed: now });
        }

        // Update Markov chain: P(current | previous)
        if (this.lastCommand) {
            this.addMarkovTransition(this.lastCommand, trimmed, 2);
        }

        // Update character-level n-grams (trigrams)
        this.updateNgrams(trimmed);

        this.lastCommand = trimmed;

        // Prune if history gets too large
        if (this.history.size > MAX_HISTORY) {
            this.pruneHistory();
        }
    }

    /**
     * Get the best predictions for the current input.
     */
    predict(currentInput: string, maxResults: number = MAX_SUGGESTIONS): Suggestion[] {
        const prefix = currentInput.trim().toLowerCase();
        if (!prefix || prefix.length < 1) return [];

        const candidates: Map<string, Suggestion> = new Map();
        const now = Date.now();

        // 1. History-based suggestions (frecency scored)
        for (const entry of this.history.values()) {
            if (entry.command.toLowerCase().startsWith(prefix) && entry.command !== currentInput.trim()) {
                const frecency = this.calculateFrecency(entry, now);
                const existing = candidates.get(entry.command);
                if (!existing || existing.score < frecency) {
                    candidates.set(entry.command, {
                        command: entry.command,
                        score: frecency,
                        source: 'history',
                    });
                }
            }
        }

        // 2. Markov chain suggestions (if we have a previous command)
        if (this.lastCommand) {
            const transitions = this.markov.get(this.normalizeForMarkov(this.lastCommand));
            if (transitions) {
                for (const t of transitions) {
                    if (t.next.toLowerCase().startsWith(prefix) && t.next !== currentInput.trim()) {
                        const markovScore = t.count * 3; // Markov gets a boost as it's context-aware
                        const existing = candidates.get(t.next);
                        if (!existing || existing.score < markovScore) {
                            candidates.set(t.next, {
                                command: t.next,
                                score: markovScore,
                                source: 'markov',
                            });
                        }
                    }
                }
            }
        }

        // 3. N-gram scoring boost for partial matches
        for (const [cmd, suggestion] of candidates) {
            const ngramScore = this.scoreByNgrams(prefix, cmd.toLowerCase());
            suggestion.score += ngramScore;
        }

        // 4. Dictionary fallback (low priority)
        if (candidates.size < maxResults) {
            // Include user snippets with higher priority than fallback dictionary
            for (const snippet of this.userSnippets) {
                if (snippet.toLowerCase().startsWith(prefix) && !candidates.has(snippet) && snippet !== currentInput.trim()) {
                    candidates.set(snippet, {
                        command: snippet,
                        score: 0.5, // Higher than dictionary, lower than history
                        source: 'dictionary', // Reusing source type
                    });
                }
            }

            for (const cmd of TERMINAL_COMMANDS) {
                if (cmd.toLowerCase().startsWith(prefix) && !candidates.has(cmd) && cmd !== currentInput.trim()) {
                    candidates.set(cmd, {
                        command: cmd,
                        score: 0.1, // Very low priority
                        source: 'dictionary',
                    });
                    if (candidates.size >= maxResults * 2) break;
                }
            }
        }

        // Sort by score descending, return top N
        return Array.from(candidates.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }

    /**
     * Get the single best suggestion (used for ghost text).
     */
    getBestSuggestion(currentInput: string): string | null {
        const predictions = this.predict(currentInput, 1);
        return predictions.length > 0 ? predictions[0].command : null;
    }

    /**
     * Calculate frecency score: frequency weighted by recency.
     */
    private calculateFrecency(entry: CommandEntry, now: number): number {
        const age = now - entry.lastUsed;
        const decay = Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
        return entry.count * decay;
    }

    /**
     * Add a transition to the Markov chain.
     */
    private addMarkovTransition(from: string, to: string, weight: number): void {
        const key = this.normalizeForMarkov(from);
        let transitions = this.markov.get(key);
        if (!transitions) {
            transitions = [];
            this.markov.set(key, transitions);
        }

        const existing = transitions.find(t => t.next === to);
        if (existing) {
            existing.count += weight;
        } else {
            transitions.push({ next: to, count: weight });
        }
    }

    /**
     * Normalize command for Markov key (strip arguments for better generalization).
     * "git commit -m 'hello'" → "git commit"
     */
    private normalizeForMarkov(cmd: string): string {
        const parts = cmd.trim().split(/\s+/);
        // Keep first 2 parts for context (e.g., "git commit", "docker compose")
        return parts.slice(0, Math.min(parts.length, 2)).join(' ').toLowerCase();
    }

    /**
     * Update character-level trigrams for a command.
     */
    private updateNgrams(command: string): void {
        const lower = command.toLowerCase();
        for (let i = 0; i <= lower.length - 3; i++) {
            const trigram = lower.substring(i, i + 3);
            this.ngrams.set(trigram, (this.ngrams.get(trigram) || 0) + 1);
        }
    }

    /**
     * Score a candidate command by n-gram overlap with the prefix.
     */
    private scoreByNgrams(prefix: string, candidate: string): number {
        let score = 0;
        for (let i = 0; i <= prefix.length - 3; i++) {
            const trigram = prefix.substring(i, i + 3);
            const freq = this.ngrams.get(trigram) || 0;
            if (candidate.includes(trigram)) {
                score += freq * 0.1;
            }
        }
        return score;
    }

    /**
     * Remove oldest, least-used entries when history exceeds max.
     */
    private pruneHistory(): void {
        const now = Date.now();
        const entries = Array.from(this.history.entries())
            .map(([key, entry]) => ({ key, score: this.calculateFrecency(entry, now) }))
            .sort((a, b) => a.score - b.score);

        // Remove bottom 20%
        const removeCount = Math.floor(entries.length * 0.2);
        for (let i = 0; i < removeCount; i++) {
            this.history.delete(entries[i].key);
        }
    }

    /**
     * Serialize the model to JSON for persistence.
     */
    serialize(): string {
        const data: ModelData = {
            history: Array.from(this.history.values()),
            markov: Object.fromEntries(this.markov),
            ngrams: Object.fromEntries(this.ngrams),
            version: MODEL_VERSION,
        };
        return JSON.stringify(data);
    }

    /**
     * Deserialize the model from JSON.
     */
    deserialize(json: string): void {
        try {
            const data: ModelData = JSON.parse(json);
            if (data.version !== MODEL_VERSION) {
                console.warn('CommandPredictor: model version mismatch, starting fresh');
                return;
            }

            this.history.clear();
            for (const entry of data.history) {
                this.history.set(entry.command, entry);
            }

            this.markov.clear();
            for (const [key, transitions] of Object.entries(data.markov)) {
                this.markov.set(key, transitions);
            }

            this.ngrams.clear();
            for (const [key, count] of Object.entries(data.ngrams)) {
                this.ngrams.set(key, count as number);
            }

            // Re-bootstrap dictionary sequences (they won't duplicate due to count addition)
            this.bootstrapFromDictionary();
        } catch (e) {
            console.error('CommandPredictor: failed to deserialize model', e);
        }
    }

    /**
     * Set the last command (used when restoring state).
     */
    setLastCommand(cmd: string | null): void {
        this.lastCommand = cmd;
    }

    /**
     * Search command history (for Ctrl+R reverse-i-search).
     * Returns commands containing the query, sorted by frecency.
     */
    searchHistory(query: string, maxResults: number = 20): string[] {
        const q = query.toLowerCase();
        const now = Date.now();
        return Array.from(this.history.values())
            .filter(entry => entry.command.toLowerCase().includes(q))
            .sort((a, b) => this.calculateFrecency(b, now) - this.calculateFrecency(a, now))
            .slice(0, maxResults)
            .map(entry => entry.command);
    }

    /**
     * Get all history commands sorted by recency.
     */
    getAllHistory(): string[] {
        return Array.from(this.history.values())
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .map(entry => entry.command);
    }

    /**
     * Get model stats for debugging.
     */
    getStats(): { historySize: number; markovKeys: number; ngramCount: number } {
        return {
            historySize: this.history.size,
            markovKeys: this.markov.size,
            ngramCount: this.ngrams.size,
        };
    }
}
