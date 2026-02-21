import React from 'react';
import { Cable, ExternalLink, Box } from 'lucide-react';

interface DockerContainer {
    ID: string;
    Names: string;
    Ports: string;
}

interface DockerPortForwardsProps {
    containers: DockerContainer[];
    host: string;
}

interface PortMapping {
    containerName: string;
    containerId: string;
    hostIp: string;
    hostPort: string;
    containerPort: string;
    protocol: string;
}

export const DockerPortForwards: React.FC<DockerPortForwardsProps> = ({ containers, host }) => {

    // Parse the ports string into structured objects
    const mappings: PortMapping[] = [];

    containers.forEach(c => {
        if (!c.Ports) return;

        // e.g. "0.0.0.0:3306->3306/tcp, :::3306->3306/tcp, 33060/tcp"
        const portSegments = c.Ports.split(',').map(s => s.trim());

        portSegments.forEach(segment => {
            if (segment.includes('->')) {
                // e.g. "0.0.0.0:3306->3306/tcp"
                const [hostPart, containerPart] = segment.split('->');

                // containerPart mostly looks like "3306/tcp"
                let cPort = containerPart;
                let proto = 'tcp';
                if (containerPart.includes('/')) {
                    const [p, pt] = containerPart.split('/');
                    cPort = p;
                    proto = pt;
                }

                // hostPart mostly looks like "0.0.0.0:3306" or "::1:3306"
                let targetHostIp = host; // default to the server's SSH IP
                let hPort = hostPart;
                if (hostPart.includes(':')) {
                    const parts = hostPart.split(':');
                    hPort = parts.pop() || '';
                    const ip = parts.join(':');
                    // if explicitly mapped to localhost, we still want to show the target host IP if we want to open it
                    // but let's just show it as is. Usually it's 0.0.0.0
                    targetHostIp = ip === '0.0.0.0' || ip === '::' ? host : ip;
                }

                mappings.push({
                    containerName: c.Names,
                    containerId: c.ID,
                    hostIp: targetHostIp,
                    hostPort: hPort,
                    containerPort: cPort,
                    protocol: proto
                });
            }
        });
    });

    // Remove duplicates (e.g. IPv4 and IPv6 mappings for the same port)
    const uniqueMappings = mappings.reduce((acc, current) => {
        const key = `${current.hostPort}-${current.containerPort}-${current.protocol}`;
        if (!acc.find(item => `${item.hostPort}-${item.containerPort}-${item.protocol}` === key)) {
            acc.push(current);
        }
        return acc;
    }, [] as PortMapping[]);

    const openInBrowser = (url: string) => {
        // Use Tauri's shell open if we want, or just a normal anchor tag
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-sidebar)]">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Cable size={18} className="text-[var(--accent-color)]" />
                    <div>
                        <h3 className="text-sm font-bold text-[var(--text-main)]">Port Forwarding Manager</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Active port mappings to the host</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col">
                {uniqueMappings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
                        <Cable size={48} className="text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-main)]">No active port forwards found</span>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[var(--bg-sidebar)] border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Container</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Container Port</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Host Mapping</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {uniqueMappings.map((m, idx) => {
                                    const isHttp = m.hostPort === '80' || m.hostPort === '8080' || m.hostPort === '3000' || m.containerPort.includes('80');
                                    const isHttps = m.hostPort === '443' || m.hostPort === '8443' || m.containerPort.includes('443');
                                    const scheme = isHttps ? 'https://' : 'http://';
                                    const url = `${scheme}${m.hostIp === '127.0.0.1' ? 'localhost' : m.hostIp}:${m.hostPort}`;

                                    return (
                                        <tr key={idx} className="hover:bg-[var(--hover-color)]/30 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Box size={14} className="text-[var(--text-muted)]" />
                                                    <span className="font-bold text-[var(--text-main)]" title={m.containerName}>{m.containerName}</span>
                                                    <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border-color)] rounded px-1">{m.containerId.substring(0, 8)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-[var(--accent-color)]">{m.containerPort}</span>
                                                <span className="text-[10px] text-[var(--text-muted)] ml-1 uppercase">{m.protocol}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[#10B981]">{m.hostPort}</span>
                                                    <span className="text-[10px] text-[var(--text-muted)] opacity-50">on {m.hostIp}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {(isHttp || isHttps || m.protocol === 'tcp') && (
                                                    <button
                                                        onClick={() => openInBrowser(url)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white font-medium rounded transition-colors text-xs"
                                                        title={`Open ${url}`}
                                                    >
                                                        <span>Open</span>
                                                        <ExternalLink size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
