import React, { useState, useCallback } from 'react';
import { Globe, Radio, MapPin, Search, Copy, Loader2, AlertCircle } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';

interface NetworkToolsProps {
    profile: SshProfile;
    sessionId: string;
    onClose: () => void;
}

type ToolTab = 'ping' | 'traceroute' | 'dns';

// ─── Ping Parser ───────────────────────────────────────────────────────────────
interface PingResult {
    lines: { seq: number; host: string; time: number | null; ttl: number | null }[];
    summary: { sent: number; received: number; loss: string; min: number; avg: number; max: number } | null;
}

function parsePing(raw: string): PingResult {
    const lines: PingResult['lines'] = [];
    let summary: PingResult['summary'] = null;

    for (const line of raw.split('\n')) {
        // Match: 64 bytes from host: icmp_seq=1 ttl=64 time=0.5 ms
        const m = line.match(/icmp_seq[=:](\d+).*ttl[=:](\d+).*time[=:]([0-9.]+)/i);
        if (m) {
            lines.push({ seq: parseInt(m[1]), host: '', time: parseFloat(m[3]), ttl: parseInt(m[2]) });
        }
        // Timeout line
        if (line.includes('Request timeout') || line.includes('no answer')) {
            lines.push({ seq: lines.length + 1, host: '', time: null, ttl: null });
        }
        // Summary: 10 packets transmitted, 10 received, 0% packet loss
        const sm = line.match(/(\d+)\s+packets?\s+transmitted.*?(\d+)\s+received.*?([0-9.]+)%\s+(?:packet\s+)?loss/i);
        if (sm) {
            summary = { sent: parseInt(sm[1]), received: parseInt(sm[2]), loss: sm[3] + '%', min: 0, avg: 0, max: 0 };
        }
        // rtt min/avg/max = 0.1/0.2/0.3 ms
        const rm = line.match(/(\d+[.]\d+)\/(\d+[.]\d+)\/(\d+[.]\d+)/);
        if (rm && summary) {
            summary.min = parseFloat(rm[1]);
            summary.avg = parseFloat(rm[2]);
            summary.max = parseFloat(rm[3]);
        }
    }
    return { lines, summary };
}

// ─── Traceroute Parser ─────────────────────────────────────────────────────────
interface TraceHop {
    hop: number;
    host: string;
    ip: string;
    rtt: string;
}

function parseTraceroute(raw: string): TraceHop[] {
    const hops: TraceHop[] = [];
    for (const line of raw.split('\n')) {
        const m = line.match(/^\s*(\d+)\s+(.+)/);
        if (!m) continue;
        const hop = parseInt(m[1]);
        const rest = m[2].trim();
        if (rest.includes('* * *')) {
            hops.push({ hop, host: '* * *', ip: '', rtt: '—' });
        } else {
            // Try: hostname (ip) time ms
            const dm = rest.match(/^(\S+)\s+\(([^)]+)\)\s+(.*)/);
            if (dm) {
                hops.push({ hop, host: dm[1], ip: dm[2], rtt: dm[3].replace(/\s+ms/g, 'ms').trim() });
            } else {
                hops.push({ hop, host: rest.split(/\s+/)[0] || rest, ip: '', rtt: rest });
            }
        }
    }
    return hops;
}

// ─── DNS Parser ────────────────────────────────────────────────────────────────
interface DnsRecord {
    name: string;
    ttl: string;
    type: string;
    value: string;
}

function parseDns(raw: string): DnsRecord[] {
    const records: DnsRecord[] = [];
    for (const line of raw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[2] === 'IN') {
            records.push({ name: parts[0], ttl: parts[1], type: parts[3], value: parts.slice(4).join(' ') });
        }
    }
    return records;
}

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────
const LatencySparkline: React.FC<{ data: (number | null)[] }> = ({ data }) => {
    const valid = data.filter((v): v is number => v !== null);
    if (valid.length < 2) return null;
    const max = Math.max(...valid, 1);
    const w = 280;
    const h = 40;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = v !== null ? h - (v / max) * (h - 4) : h;
        return `${x},${y}`;
    }).join(' ');
    const area = `0,${h} ${points} ${w},${h}`;

    return (
        <svg width={w} height={h} className="overflow-visible">
            <polygon fill="#3b82f620" points={area} />
            <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const NetworkTools: React.FC<NetworkToolsProps> = ({ profile, sessionId, onClose }) => {
    const { height, startResizing, isResizing } = useResizable(320, 200, 600, 'top', 'cliqon-nettools-height');
    const [activeTab, setActiveTab] = useState<ToolTab>('ping');
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawOutput, setRawOutput] = useState('');
    const [pingResult, setPingResult] = useState<PingResult | null>(null);
    const [traceResult, setTraceResult] = useState<TraceHop[]>([]);
    const [dnsResult, setDnsResult] = useState<DnsRecord[]>([]);

    const runTool = useCallback(async () => {
        if (!target.trim()) return;
        setLoading(true);
        setError(null);
        setRawOutput('');
        setPingResult(null);
        setTraceResult([]);
        setDnsResult([]);

        try {
            const result = await api.runNetTool(profile, sessionId, activeTab, target.trim());
            setRawOutput(result);

            if (activeTab === 'ping') setPingResult(parsePing(result));
            else if (activeTab === 'traceroute') setTraceResult(parseTraceroute(result));
            else if (activeTab === 'dns') setDnsResult(parseDns(result));
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [target, activeTab, profile, sessionId]);

    const copyOutput = () => {
        if (rawOutput) navigator.clipboard.writeText(rawOutput);
    };

    const tabs: { id: ToolTab; label: string; icon: React.ReactNode }[] = [
        { id: 'ping', label: 'Ping', icon: <Radio size={13} /> },
        { id: 'traceroute', label: 'Traceroute', icon: <MapPin size={13} /> },
        { id: 'dns', label: 'DNS Lookup', icon: <Search size={13} /> },
    ];

    return (
        <div
            className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-hidden relative flex flex-col"
            style={{ height }}
        >
            {/* Resize Handle */}
            <div
                onMouseDown={startResizing}
                className={`absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-50 transition-colors duration-200 group
                    ${isResizing ? 'bg-[var(--accent-color)]' : 'hover:bg-[var(--accent-color)]/30'}`}
            >
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 rounded-full bg-[var(--border-color)] group-hover:bg-[var(--accent-color)]/50 transition-colors ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0 select-none">
                <div className="flex items-center gap-3">
                    <Globe size={16} className="text-[var(--accent-color)]" />
                    <span className="text-sm font-bold text-[var(--text-main)]">Network Tools</span>

                    {/* Tool Tabs */}
                    <div className="flex gap-1 ml-2">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => { setActiveTab(t.id); setRawOutput(''); setPingResult(null); setTraceResult([]); setDnsResult([]); setError(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${activeTab === t.id
                                    ? 'bg-[var(--accent-color)] text-white shadow-sm'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--hover-color)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 shrink-0">
                <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && runTool()}
                    placeholder={activeTab === 'dns' ? 'example.com' : '8.8.8.8 or example.com'}
                    className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors font-mono"
                />
                <button
                    onClick={runTool}
                    disabled={loading || !target.trim()}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-lg bg-[var(--accent-color)] text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
                    {activeTab === 'ping' ? 'Ping' : activeTab === 'traceroute' ? 'Trace' : 'Lookup'}
                </button>
                {rawOutput && (
                    <button onClick={copyOutput} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors" title="Copy raw output">
                        <Copy size={14} />
                    </button>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {error && (
                    <div className="flex items-center gap-2 text-red-400 text-xs py-2">
                        <AlertCircle size={14} />
                        <span>{error}</span>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-[var(--text-muted)]">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Running {activeTab}...</span>
                    </div>
                )}

                {!loading && !error && !rawOutput && (
                    <div className="flex flex-col items-center justify-center gap-3 py-8 text-[var(--text-muted)] opacity-60">
                        <Globe size={32} />
                        <span className="text-sm">Enter a target and run a diagnostic</span>
                    </div>
                )}

                {/* Ping Results */}
                {activeTab === 'ping' && pingResult && !loading && (
                    <div className="space-y-4">
                        {/* Sparkline */}
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4">
                            <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Latency (ms)</div>
                            <LatencySparkline data={pingResult.lines.map(l => l.time)} />
                        </div>

                        {/* Summary */}
                        {pingResult.summary && (
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Sent', value: pingResult.summary.sent, color: 'text-blue-400' },
                                    { label: 'Loss', value: pingResult.summary.loss, color: pingResult.summary.loss === '0%' ? 'text-emerald-400' : 'text-red-400' },
                                    { label: 'Avg', value: `${pingResult.summary.avg.toFixed(1)}ms`, color: 'text-[var(--accent-color)]' },
                                    { label: 'Max', value: `${pingResult.summary.max.toFixed(1)}ms`, color: 'text-amber-400' },
                                ].map(s => (
                                    <div key={s.label} className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3 text-center">
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{s.label}</div>
                                        <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Individual lines */}
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3 max-h-32 overflow-y-auto">
                            <div className="font-mono text-[11px] text-[var(--text-muted)] space-y-0.5">
                                {pingResult.lines.map((l, i) => (
                                    <div key={i} className={l.time === null ? 'text-red-400' : ''}>
                                        {l.time !== null ? `seq=${l.seq} ttl=${l.ttl} time=${l.time}ms` : `seq=${l.seq} timeout`}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Traceroute Results */}
                {activeTab === 'traceroute' && traceResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                                    <th className="py-2 px-3 text-left font-bold w-12">#</th>
                                    <th className="py-2 px-3 text-left font-bold">Host</th>
                                    <th className="py-2 px-3 text-left font-bold">IP</th>
                                    <th className="py-2 px-3 text-right font-bold">RTT</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {traceResult.map((hop, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-1.5 px-3 text-[var(--accent-color)] font-bold">{hop.hop}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-main)]">{hop.host}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)]">{hop.ip || '—'}</td>
                                        <td className="py-1.5 px-3 text-right text-[var(--text-muted)]">{hop.rtt}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* DNS Results */}
                {activeTab === 'dns' && dnsResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                                    <th className="py-2 px-3 text-left font-bold">Name</th>
                                    <th className="py-2 px-3 text-left font-bold w-16">TTL</th>
                                    <th className="py-2 px-3 text-left font-bold w-16">Type</th>
                                    <th className="py-2 px-3 text-left font-bold">Value</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {dnsResult.map((r, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-1.5 px-3 text-[var(--text-main)]">{r.name}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)]">{r.ttl}</td>
                                        <td className="py-1.5 px-3">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.type === 'A' ? 'bg-blue-500/20 text-blue-400' :
                                                r.type === 'AAAA' ? 'bg-purple-500/20 text-purple-400' :
                                                    r.type === 'CNAME' ? 'bg-green-500/20 text-green-400' :
                                                        r.type === 'MX' ? 'bg-amber-500/20 text-amber-400' :
                                                            'bg-[var(--hover-color)] text-[var(--text-muted)]'
                                                }`}>
                                                {r.type}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)] break-all">{r.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Raw output fallback for DNS with no parsed records */}
                {activeTab === 'dns' && dnsResult.length === 0 && rawOutput && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3">
                        <pre className="font-mono text-[11px] text-[var(--text-muted)] whitespace-pre-wrap">{rawOutput}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};
