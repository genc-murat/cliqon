import React, { useState, useEffect, useRef } from 'react';
import { Network, AlertCircle, RefreshCw, FileText, Check, X } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';
import yaml from 'js-yaml';
import mermaid from 'mermaid';

interface DockerComposeVisualizerProps {
    profile: SshProfile;
    initialPath?: string;
    onClose: () => void;
}

export const DockerComposeVisualizer: React.FC<DockerComposeVisualizerProps> = ({ profile, initialPath, onClose }) => {
    const [path, setPath] = useState<string>(initialPath || 'docker-compose.yml');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [composeData, setComposeData] = useState<any>(null);
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'monospace',
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (initialPath) {
            handleLoad();
        }
        // We only want to auto-load once when the modal mounts with an initialPath.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLoad = async () => {
        if (!path.trim()) {
            setError("Path cannot be empty");
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSuccessMsg(null);
            setComposeData(null);
            if (mermaidRef.current) {
                mermaidRef.current.innerHTML = '';
            }

            const content = await api.readDockerCompose(profile, path);

            if (!content || content.trim() === "") {
                setError("Could not read the file. It may be empty, the path may be incorrect, or you lack read permissions.");
                setLoading(false);
                return;
            }

            const parsed = yaml.load(content);
            console.log("Parsed compose file:", parsed);
            setComposeData(parsed);

            if (parsed && typeof parsed === 'object') {
                const servicesKey = Object.keys(parsed).find(k => k.toLowerCase() === 'services');
                if (servicesKey && (parsed as any)[servicesKey]) {
                    renderMermaid((parsed as any)[servicesKey]);
                    setSuccessMsg("Successfully loaded and parsed architecture.");
                } else {
                    setError("Invalid docker-compose format. No 'services' block found.");
                    console.error("Parsed compose object lacked services:", parsed);
                }
            } else {
                setError(`Failed to parse YAML. The file content is likely invalid. Received type: ${typeof parsed}`);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const renderMermaid = async (services: Record<string, any>) => {
        if (!mermaidRef.current) return;

        let graphDef = 'graph TD\n';

        // Add nodes
        Object.keys(services).forEach(serviceName => {
            const svc = services[serviceName];
            const imageStr = svc.image ? `\\n<span style="font-size:10px; color:#aaa">${svc.image}</span>` : '';
            graphDef += `    ${serviceName}["<b>${serviceName}</b>${imageStr}"]\n`;
            graphDef += `    style ${serviceName} fill:#2496ED20,stroke:#2496ED,stroke-width:2px,color:#fff;\n`;
        });

        // Add edges based on depends_on
        Object.keys(services).forEach(serviceName => {
            const svc = services[serviceName];
            if (svc.depends_on) {
                if (Array.isArray(svc.depends_on)) { // old format
                    svc.depends_on.forEach((dep: string) => {
                        graphDef += `    ${serviceName} -.depends on.-> ${dep}\n`;
                    });
                } else if (typeof svc.depends_on === 'object') { // new format
                    Object.keys(svc.depends_on).forEach(dep => {
                        graphDef += `    ${serviceName} -.depends on.-> ${dep}\n`;
                    });
                }
            }
        });

        // Add edges based on links (legacy but sometimes used)
        Object.keys(services).forEach(serviceName => {
            const svc = services[serviceName];
            if (svc.links && Array.isArray(svc.links)) {
                svc.links.forEach((linkObj: string) => {
                    const target = linkObj.split(':')[0];
                    graphDef += `    ${serviceName} --links to--> ${target}\n`;
                });
            }
        });

        try {
            const { svg } = await mermaid.render('mermaid-graph', graphDef);
            mermaidRef.current.innerHTML = svg;
        } catch (err) {
            console.error("Mermaid Render Error:", err);
            setError("Failed to render architecture diagram.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col w-full max-w-5xl h-[80vh] overflow-hidden">
                <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Network size={18} className="text-[var(--accent-color)]" />
                        <div>
                            <h3 className="text-sm font-bold text-[var(--text-main)]">Compose Architecture Visualizer</h3>
                            <p className="text-[11px] text-[var(--text-muted)]">Analyze dependencies and service links</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-md transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Path to docker-compose.yml</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FileText size={14} className="text-[var(--text-muted)]" />
                                </div>
                                <input
                                    type="text"
                                    value={path}
                                    onChange={(e) => setPath(e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                                    placeholder="/opt/myapp/docker-compose.yml"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleLoad();
                                    }}
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleLoad}
                            disabled={loading || !path.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Network size={16} />}
                            Visualize
                        </button>
                    </div>
                    {error && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}
                    {successMsg && !error && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs">
                            <Check size={14} />
                            {successMsg}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-4 flex flex-col">
                    {!composeData && !loading && !error && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
                            <Network size={48} className="text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-main)]">Enter a path to visualize the architecture</span>
                        </div>
                    )}
                    <div
                        ref={mermaidRef}
                        className="flex-1 w-full flex items-center justify-center p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-auto"
                    >
                        {/* Mermaid renders here */}
                    </div>
                </div>
            </div>
        </div>
    );
};
