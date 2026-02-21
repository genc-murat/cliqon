import React, { useState, useCallback } from 'react';
import { Globe, Radio, MapPin, Search, Copy, Loader2, AlertCircle, Shield, Activity, Network, ExternalLink, Navigation2, Users, List, Link, Lock, PieChart, ArrowUpCircle, Zap } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import { useResizable } from '../../hooks/useResizable';

interface NetworkToolsProps {
    profile: SshProfile;
    sessionId: string;
    onClose: () => void;
    isEmbedded?: boolean;
}

type ToolTab = 'ping' | 'traceroute' | 'dns' | 'portscan' | 'connections' | 'interfaces' | 'public_ip' | 'routes' | 'neighbors' | 'listening' | 'http_check' | 'ssl_check' | 'stats_summary' | 'bandwidth_stats' | 'firewall_status';

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

// ─── Port Scan Parser ──────────────────────────────────────────────────────────
interface PortScanResult {
    port: string;
    status: 'open' | 'closed';
    service: string;
}

function parsePortScan(raw: string): PortScanResult[] {
    const results: PortScanResult[] = [];
    for (const line of raw.split('\n')) {
        // Connection to 8.8.8.8 443 port [tcp/https] succeeded!
        const m = line.match(/Connection to .* (\d+) port \[(.*)\] succeeded/i);
        if (m) {
            results.push({ port: m[1], status: 'open', service: m[2] });
        }
        // Connection to 8.8.8.8 80 port [tcp/http] failed: Connection refused
        const fm = line.match(/Connection to .* (\d+) port \[(.*)\] failed/i);
        if (fm) {
            results.push({ port: fm[1], status: 'closed', service: fm[2] });
        }
    }
    return results;
}

// ─── Connections Parser ────────────────────────────────────────────────────────
interface NetConnection {
    proto: string;
    local: string;
    foreign: string;
    state: string;
    pid: string;
}

function parseConnections(raw: string): NetConnection[] {
    const conns: NetConnection[] = [];
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('Netid') || line.startsWith('Active')) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
            conns.push({
                proto: parts[0],
                local: parts[3] || parts[4],
                foreign: parts[4] || parts[5],
                state: parts[1] || '',
                pid: parts[parts.length - 1] || ''
            });
        }
    }
    return conns;
}

// ─── Interfaces Parser ─────────────────────────────────────────────────────────
interface NetInterface {
    index: string;
    name: string;
    status: string;
    ips: string[];
}

function parseInterfaces(raw: string): NetInterface[] {
    const ifaces: NetInterface[] = [];
    let current: NetInterface | null = null;

    for (const line of raw.split('\n')) {
        const nm = line.match(/^(\d+):\s+([^:]+):\s+<(.*)>/);
        if (nm) {
            if (current) ifaces.push(current);
            current = { index: nm[1], name: nm[2], status: nm[3], ips: [] };
            continue;
        }
        const im = line.match(/^\s+inet\s+([^\s/]+)/);
        if (im && current) {
            current.ips.push(im[1]);
        }
    }
    if (current) ifaces.push(current);
    return ifaces;
}

// ─── Routes Parser ─────────────────────────────────────────────────────────────
interface RouteEntry {
    destination: string;
    gateway: string;
    dev: string;
    proto: string;
    scope: string;
}

function parseRoutes(raw: string): RouteEntry[] {
    const routes: RouteEntry[] = [];
    for (const line of raw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;

        const devIdx = parts.indexOf('dev');
        const viaIdx = parts.indexOf('via');
        const protoIdx = parts.indexOf('proto');
        const scopeIdx = parts.indexOf('scope');

        routes.push({
            destination: parts[0],
            gateway: viaIdx !== -1 ? parts[viaIdx + 1] : '—',
            dev: devIdx !== -1 ? parts[devIdx + 1] : '—',
            proto: protoIdx !== -1 ? parts[protoIdx + 1] : '—',
            scope: scopeIdx !== -1 ? parts[scopeIdx + 1] : '—',
        });
    }
    return routes;
}

// ─── Neighbors Parser ──────────────────────────────────────────────────────────
interface NeighborEntry {
    ip: string;
    dev: string;
    lladdr: string;
    state: string;
}

function parseNeighbors(raw: string): NeighborEntry[] {
    const neighbors: NeighborEntry[] = [];
    for (const line of raw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;

        const devIdx = parts.indexOf('dev');
        const lladdrIdx = parts.indexOf('lladdr');

        neighbors.push({
            ip: parts[0],
            dev: devIdx !== -1 ? parts[devIdx + 1] : '—',
            lladdr: lladdrIdx !== -1 ? parts[lladdrIdx + 1] : '—',
            state: parts[parts.length - 1],
        });
    }
    return neighbors;
}

// ─── Listening Parser ──────────────────────────────────────────────────────────
interface ListeningPort {
    proto: string;
    local: string;
    state: string;
}

function parseListening(raw: string): ListeningPort[] {
    const ports: ListeningPort[] = [];
    for (const line of raw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4 && (parts[0].includes('tcp') || parts[0].includes('udp'))) {
            ports.push({
                proto: parts[0],
                local: parts[3] || parts[4],
                state: parts[1] || 'LISTEN',
            });
        }
    }
    return ports;
}

// ─── HTTP Header Parser ────────────────────────────────────────────────────────
interface HttpHeader {
    key: string;
    value: string;
}

// ─── Socket Stats Parser ───────────────────────────────────────────────────────
interface SocketStat {
    type: string;
    total: string;
    extra?: string;
}

function parseSocketStats(raw: string): SocketStat[] {
    const stats: SocketStat[] = [];
    for (const line of raw.split('\n')) {
        const m = line.match(/^(\S+)\s+(\d+)(.*)/);
        if (m) {
            stats.push({ type: m[1], total: m[2], extra: m[3].trim() });
        }
    }
    return stats;
}

// ─── Bandwidth Parser ──────────────────────────────────────────────────────────
interface BandwidthStat {
    iface: string;
    rxBytes: string;
    rxPackets: string;
    txBytes: string;
    txPackets: string;
}

function parseBandwidth(raw: string): BandwidthStat[] {
    const stats: BandwidthStat[] = [];
    const lines = raw.split('\n');
    for (const line of lines) {
        if (!line.includes(':')) continue;
        const [iface, rest] = line.split(':');
        const parts = rest.trim().split(/\s+/);
        if (parts.length >= 10) {
            stats.push({
                iface: iface.trim(),
                rxBytes: parts[0],
                rxPackets: parts[1],
                txBytes: parts[8],
                txPackets: parts[9],
            });
        }
    }
    return stats;
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

const isSelfTool = (tab: ToolTab) =>
    ['connections', 'interfaces', 'public_ip', 'routes', 'neighbors', 'listening', 'stats_summary', 'bandwidth_stats', 'firewall_status'].includes(tab);

// ─── Main Component ────────────────────────────────────────────────────────────
export const NetworkTools: React.FC<NetworkToolsProps> = ({ profile, sessionId, onClose, isEmbedded }) => {
    const { height, startResizing, isResizing } = useResizable(320, 200, 600, 'top', 'cliqon-nettools-height');
    const [activeTab, setActiveTab] = useState<ToolTab>('ping');
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rawOutput, setRawOutput] = useState('');
    const [pingResult, setPingResult] = useState<PingResult | null>(null);
    const [traceResult, setTraceResult] = useState<TraceHop[]>([]);
    const [dnsResult, setDnsResult] = useState<DnsRecord[]>([]);
    const [portScanResult, setPortScanResult] = useState<PortScanResult[]>([]);
    const [connResult, setConnResult] = useState<NetConnection[]>([]);
    const [ifaceResult, setIfaceResult] = useState<NetInterface[]>([]);
    const [routeResult, setRouteResult] = useState<RouteEntry[]>([]);
    const [neighborResult, setNeighborResult] = useState<NeighborEntry[]>([]);
    const [listeningResult, setListeningResult] = useState<ListeningPort[]>([]);
    const [httpResult, setHttpResult] = useState<HttpHeader[]>([]);
    const [socketStats, setSocketStats] = useState<SocketStat[]>([]);
    const [bandwidth, setBandwidth] = useState<BandwidthStat[]>([]);
    const [publicIp, setPublicIp] = useState<string>('');

    const parseHttpHeadersLocal = (raw: string): HttpHeader[] => {
        const headers: HttpHeader[] = [];
        for (const line of raw.split('\n')) {
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1) {
                headers.push({
                    key: line.slice(0, colonIdx).trim(),
                    value: line.slice(colonIdx + 1).trim(),
                });
            } else if (line.startsWith('HTTP/')) {
                headers.push({ key: 'Status', value: line.trim() });
            }
        }
        return headers;
    };

    const runTool = useCallback(async () => {
        const self = isSelfTool(activeTab);
        if (!self && !target.trim()) return;

        setLoading(true);
        setError(null);
        setRawOutput('');
        setPingResult(null);
        setTraceResult([]);
        setDnsResult([]);
        setPortScanResult([]);
        setConnResult([]);
        setIfaceResult([]);
        setRouteResult([]);
        setNeighborResult([]);
        setListeningResult([]);
        setHttpResult([]);
        setSocketStats([]);
        setBandwidth([]);
        setPublicIp('');

        try {
            const result = await api.runNetTool(profile, sessionId, activeTab, self ? '127.0.0.1' : target.trim());
            setRawOutput(result);

            if (activeTab === 'ping') setPingResult(parsePing(result));
            else if (activeTab === 'traceroute') setTraceResult(parseTraceroute(result));
            else if (activeTab === 'dns') setDnsResult(parseDns(result));
            else if (activeTab === 'portscan') setPortScanResult(parsePortScan(result));
            else if (activeTab === 'connections') setConnResult(parseConnections(result));
            else if (activeTab === 'interfaces') setIfaceResult(parseInterfaces(result));
            else if (activeTab === 'public_ip') setPublicIp(result.trim());
            else if (activeTab === 'routes') setRouteResult(parseRoutes(result));
            else if (activeTab === 'neighbors') setNeighborResult(parseNeighbors(result));
            else if (activeTab === 'listening') setListeningResult(parseListening(result));
            else if (activeTab === 'http_check') setHttpResult(parseHttpHeadersLocal(result));
            else if (activeTab === 'stats_summary') setSocketStats(parseSocketStats(result));
            else if (activeTab === 'bandwidth_stats') setBandwidth(parseBandwidth(result));
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [target, activeTab, profile, sessionId]);

    // Auto-run for self-tools on tab switch
    React.useEffect(() => {
        if (isSelfTool(activeTab)) {
            runTool();
        }
    }, [activeTab]);

    const copyOutput = () => {
        if (rawOutput) navigator.clipboard.writeText(rawOutput);
    };

    const tabs: { id: ToolTab; label: string; icon: React.ReactNode }[] = [
        { id: 'ping', label: 'Ping', icon: <Radio size={13} /> },
        { id: 'traceroute', label: 'Traceroute', icon: <MapPin size={13} /> },
        { id: 'dns', label: 'DNS Lookup', icon: <Search size={13} /> },
        { id: 'portscan', label: 'Port Scan', icon: <Shield size={13} /> },
        { id: 'connections', label: 'Connections', icon: <Activity size={13} /> },
        { id: 'interfaces', label: 'Interfaces', icon: <Network size={13} /> },
        { id: 'public_ip', label: 'Public IP', icon: <ExternalLink size={13} /> },
        { id: 'routes', label: 'Routes', icon: <Navigation2 size={13} /> },
        { id: 'neighbors', label: 'ARP Neighbors', icon: <Users size={13} /> },
        { id: 'listening', label: 'Listening', icon: <List size={13} /> },
        { id: 'http_check', label: 'HTTP Check', icon: <Link size={13} /> },
        { id: 'ssl_check', label: 'SSL Info', icon: <Lock size={13} /> },
        { id: 'stats_summary', label: 'Socket Stats', icon: <PieChart size={13} /> },
        { id: 'bandwidth_stats', label: 'Bandwidth', icon: <ArrowUpCircle size={13} /> },
        { id: 'firewall_status', label: 'Firewall', icon: <Zap size={13} /> },
    ];

    return (
        <div
            className={`bg-[var(--bg-sidebar)] shrink-0 overflow-hidden relative flex flex-col ${isEmbedded ? 'flex-1 h-full' : 'border-t border-[var(--border-color)]'}`}
            style={isEmbedded ? {} : { height }}
        >
            {/* Resize Handle */}
            {!isEmbedded && (
                <div
                    onMouseDown={startResizing}
                    className={`absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-50 transition-colors duration-200 group
                        ${isResizing ? 'bg-[var(--accent-color)]' : 'hover:bg-[var(--accent-color)]/30'}`}
                >
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 rounded-full bg-[var(--border-color)] group-hover:bg-[var(--accent-color)]/50 transition-colors ${isResizing ? 'bg-[var(--accent-color)]' : ''}`} />
                </div>
            )}

            {/* Header */}
            {!isEmbedded && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0 select-none">
                    <div className="flex items-center gap-3">
                        <Globe size={16} className="text-[var(--accent-color)]" />
                        <span className="text-sm font-bold text-[var(--text-main)]">Network Tools</span>

                        {/* Tool Tabs */}
                        <div className="flex gap-1 ml-2">
                            {tabs.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setActiveTab(t.id);
                                        setRawOutput('');
                                        setPingResult(null);
                                        setTraceResult([]);
                                        setDnsResult([]);
                                        setPortScanResult([]);
                                        setConnResult([]);
                                        setIfaceResult([]);
                                        setRouteResult([]);
                                        setNeighborResult([]);
                                        setListeningResult([]);
                                        setHttpResult([]);
                                        setSocketStats([]);
                                        setBandwidth([]);
                                        setPublicIp('');
                                        setError(null);
                                    }}
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
            )}

            {isEmbedded && (
                <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/30 shrink-0 overflow-x-auto hide-scrollbar">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setActiveTab(t.id);
                                setRawOutput('');
                                setPingResult(null);
                                setTraceResult([]);
                                setDnsResult([]);
                                setPortScanResult([]);
                                setConnResult([]);
                                setIfaceResult([]);
                                setRouteResult([]);
                                setNeighborResult([]);
                                setListeningResult([]);
                                setHttpResult([]);
                                setSocketStats([]);
                                setBandwidth([]);
                                setPublicIp('');
                                setError(null);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === t.id
                                ? 'bg-[var(--accent-color)] text-white'
                                : 'text-[var(--text-muted)] hover:bg-[var(--hover-color)]'
                                }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50 shrink-0">
                <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && runTool()}
                    placeholder={activeTab === 'dns' ? 'example.com' : activeTab === 'portscan' ? '8.8.8.8' : '8.8.8.8 or example.com'}
                    disabled={isSelfTool(activeTab)}
                    className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors font-mono disabled:opacity-50"
                />
                <button
                    onClick={runTool}
                    disabled={loading || (!isSelfTool(activeTab) && !target.trim())}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-lg bg-[var(--accent-color)] text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : tabs.find(t => t.id === activeTab)?.icon}
                    {activeTab === 'ping' ? 'Ping' : activeTab === 'traceroute' ? 'Trace' : activeTab === 'dns' ? 'Lookup' : activeTab === 'portscan' ? 'Scan' : 'Run'}
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

                {/* Port Scan Results */}
                {activeTab === 'portscan' && portScanResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold w-20">Port</th>
                                    <th className="py-2 px-3 text-left font-bold w-24">Status</th>
                                    <th className="py-2 px-3 text-left font-bold">Service</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {portScanResult.map((r, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-2 px-3 text-[var(--text-main)] font-bold">{r.port}</td>
                                        <td className="py-2 px-3">
                                            <span className={`flex items-center gap-1.5 font-bold ${r.status === 'open' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'open' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
                                                {r.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">{r.service}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Connections Results */}
                {activeTab === 'connections' && connResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold w-12">Proto</th>
                                    <th className="py-2 px-3 text-left font-bold">Local Address</th>
                                    <th className="py-2 px-3 text-left font-bold">Foreign Address</th>
                                    <th className="py-2 px-3 text-left font-bold w-20">State</th>
                                    <th className="py-2 px-3 text-right font-bold">Process</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {connResult.map((c, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-1.5 px-3 text-[var(--accent-color)] font-bold uppercase">{c.proto}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-main)] truncate max-w-[150px]" title={c.local}>{c.local}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)] truncate max-w-[150px]" title={c.foreign}>{c.foreign}</td>
                                        <td className="py-1.5 px-3">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.state === 'ESTAB' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                c.state === 'LISTEN' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                    'bg-[var(--hover-color)] text-[var(--text-muted)]'
                                                }`}>
                                                {c.state}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-3 text-right text-[var(--text-muted)] text-[10px] break-all">{c.pid}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Interfaces Results */}
                {activeTab === 'interfaces' && ifaceResult.length > 0 && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ifaceResult.map((iface, i) => (
                            <div key={i} className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3 hover:border-[var(--accent-color)]/50 transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Network size={14} className="text-[var(--accent-color)]" />
                                        <span className="font-bold text-[var(--text-main)]">{iface.name}</span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${iface.status.includes('UP') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {iface.status.includes('UP') ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {iface.ips.length > 0 ? iface.ips.map((ip, j) => (
                                        <div key={j} className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50 px-2 py-1 rounded">
                                            <div className="w-1 h-1 rounded-full bg-[var(--accent-color)]" />
                                            {ip}
                                        </div>
                                    )) : (
                                        <div className="text-[10px] text-[var(--text-muted)] italic">No IP address assigned</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Raw fallback for connections/interfaces if no parsed data */}
                {(activeTab === 'connections' || activeTab === 'interfaces' || activeTab === 'portscan' || activeTab === 'routes' || activeTab === 'neighbors' || activeTab === 'listening' || activeTab === 'http_check' || activeTab === 'ssl_check' || activeTab === 'stats_summary' || activeTab === 'bandwidth_stats' || activeTab === 'firewall_status') && !loading && rawOutput &&
                    ((activeTab === 'connections' && connResult.length === 0) ||
                        (activeTab === 'interfaces' && ifaceResult.length === 0) ||
                        (activeTab === 'portscan' && portScanResult.length === 0) ||
                        (activeTab === 'routes' && routeResult.length === 0) ||
                        (activeTab === 'neighbors' && neighborResult.length === 0) ||
                        (activeTab === 'listening' && listeningResult.length === 0) ||
                        (activeTab === 'http_check' && httpResult.length === 0) ||
                        (activeTab === 'stats_summary' && socketStats.length === 0) ||
                        (activeTab === 'bandwidth_stats' && bandwidth.length === 0) ||
                        (activeTab === 'firewall_status') ||
                        (activeTab === 'ssl_check')) && (
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3">
                            <pre className="font-mono text-[11px] text-[var(--text-muted)] whitespace-pre-wrap">{rawOutput}</pre>
                        </div>
                    )}

                {/* Listening Ports Results */}
                {activeTab === 'listening' && listeningResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold w-20">Proto</th>
                                    <th className="py-2 px-3 text-left font-bold w-24">State</th>
                                    <th className="py-2 px-3 text-left font-bold">Local Address</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {listeningResult.map((r, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-2 px-3 text-[var(--accent-color)] font-bold uppercase">{r.proto}</td>
                                        <td className="py-2 px-3">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                {r.state}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-[var(--text-main)]">{r.local}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* HTTP Check Results */}
                {activeTab === 'http_check' && httpResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold w-32">Header</th>
                                    <th className="py-2 px-3 text-left font-bold">Value</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {httpResult.map((h, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-1.5 px-3 text-[var(--accent-color)] font-bold">{h.key}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)] break-all">{h.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Socket Stats Results */}
                {activeTab === 'stats_summary' && socketStats.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold w-32">Socket Type</th>
                                    <th className="py-2 px-3 text-left font-bold w-20">Total</th>
                                    <th className="py-2 px-3 text-left font-bold">Details</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {socketStats.map((s, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-2 px-3 text-[var(--accent-color)] font-bold uppercase">{s.type}</td>
                                        <td className="py-2 px-3 text-[var(--text-main)] font-black">{s.total}</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)] text-[10px] italic">{s.extra}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Bandwidth Results */}
                {activeTab === 'bandwidth_stats' && bandwidth.length > 0 && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {bandwidth.map((b, i) => (
                            <div key={i} className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--accent-color)]/50 transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-[var(--accent-color)]/10 rounded-lg">
                                        <Network size={14} className="text-[var(--accent-color)]" />
                                    </div>
                                    <span className="font-bold text-[var(--text-main)]">{b.iface}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-emerald-400" /> Receive
                                        </div>
                                        <div className="text-sm font-mono text-[var(--text-main)] font-black">{(parseInt(b.rxBytes) / (1024 * 1024)).toFixed(2)} MB</div>
                                        <div className="text-[10px] text-[var(--text-muted)]">{b.rxPackets} pkts</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-blue-400" /> Transmit
                                        </div>
                                        <div className="text-sm font-mono text-[var(--text-main)] font-black">{(parseInt(b.txBytes) / (1024 * 1024)).toFixed(2)} MB</div>
                                        <div className="text-[10px] text-[var(--text-muted)]">{b.txPackets} pkts</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Public IP Results */}
                {activeTab === 'public_ip' && publicIp && !loading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl">
                        <div className="p-4 bg-[var(--accent-color)]/10 rounded-full">
                            <ExternalLink size={32} className="text-[var(--accent-color)]" />
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Server Public IP</div>
                            <div className="text-3xl font-black text-[var(--text-main)] font-mono">{publicIp}</div>
                        </div>
                    </div>
                )}

                {/* Routes Results */}
                {activeTab === 'routes' && routeResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold">Destination</th>
                                    <th className="py-2 px-3 text-left font-bold">Gateway</th>
                                    <th className="py-2 px-3 text-left font-bold">Device</th>
                                    <th className="py-2 px-3 text-left font-bold">Proto</th>
                                    <th className="py-2 px-3 text-right font-bold">Scope</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {routeResult.map((r, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-1.5 px-3 text-[var(--text-main)] font-bold">{r.destination}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)]">{r.gateway}</td>
                                        <td className="py-1.5 px-3 text-[var(--accent-color)]">{r.dev}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)]">{r.proto}</td>
                                        <td className="py-1.5 px-3 text-right text-[var(--text-muted)]">{r.scope}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Neighbors Results */}
                {activeTab === 'neighbors' && neighborResult.length > 0 && !loading && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-sidebar)]/50">
                                    <th className="py-2 px-3 text-left font-bold">IP Address</th>
                                    <th className="py-2 px-3 text-left font-bold">Device</th>
                                    <th className="py-2 px-3 text-left font-bold">HW Address (MAC)</th>
                                    <th className="py-2 px-3 text-right font-bold text-emerald-400">State</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {neighborResult.map((n, i) => (
                                    <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--hover-color)] transition-colors">
                                        <td className="py-1.5 px-3 text-[var(--text-main)] font-bold">{n.ip}</td>
                                        <td className="py-1.5 px-3 text-[var(--accent-color)]">{n.dev}</td>
                                        <td className="py-1.5 px-3 text-[var(--text-muted)]">{n.lladdr}</td>
                                        <td className="py-1.5 px-3 text-right">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${n.state === 'REACHABLE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                n.state === 'STALE' ? 'bg-amber-500/10 text-amber-400' :
                                                    'bg-[var(--hover-color)] text-[var(--text-muted)]'
                                                }`}>
                                                {n.state}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
