import React, { useEffect, useState, useMemo } from 'react';
import { Play, Square, RotateCw, RefreshCw, Search, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface ServiceInfo {
    unit: string;
    load: string;   // loaded, not-found, error
    active: string; // active, inactive, failed
    sub: string;    // running, exited, dead
    description: string;
}

interface ServiceManagerProps {
    profile: SshProfile;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({ profile }) => {
    const [services, setServices] = useState<ServiceInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchServices = async () => {
        setLoading(true);
        setError(null);
        try {
            const raw = await api.getSystemServices(profile);
            if (raw.trim() === "systemctl not found") {
                setError("Systemctl is not available on this server.");
            } else {
                const parsed: ServiceInfo[] = raw
                    .split('\n')
                    .filter(line => line.includes('|'))
                    .map(line => {
                        const [unit, load, active, sub, description] = line.split('|');
                        return { unit, load, active, sub, description };
                    })
                    .filter(s => s.unit && s.unit.trim() !== "");
                setServices(parsed);
            }
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.id]);

    const handleAction = async (service: string, action: 'start' | 'stop' | 'restart') => {
        setActionLoading(service);
        try {
            const res = await api.manageService(profile, action, service);
            if (res.toLowerCase().includes('failed') || res.toLowerCase().includes('error') || res.toLowerCase().includes('denied')) {
                // simple heuristic for errors returned via stderr
                throw new Error(res);
            }
            // Wait a bit to let the service state settle, then refresh
            setTimeout(fetchServices, 1000);
        } catch (err: any) {
            alert(`Failed to ${action} ${service}: \n${err.message || String(err)}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredServices = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return services.filter(s =>
            s.unit.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query)
        );
    }, [services, searchQuery]);

    const getStatusIcon = (active: string, sub: string) => {
        if (active === 'active' && sub === 'running') return <CheckCircle2 size={14} className="text-green-400" />;
        if (active === 'active' && sub === 'exited') return <CheckCircle2 size={14} className="text-blue-400" />;
        if (active === 'failed') return <ShieldAlert size={14} className="text-red-400" />;
        if (active === 'inactive') return <Square size={14} className="text-[var(--text-muted)]" />;
        return <HelpCircle size={14} className="text-amber-400" />;
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                    <input
                        type="text"
                        placeholder="Search services..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--accent-color)]"
                    />
                </div>
                <button
                    onClick={fetchServices}
                    disabled={loading}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)] rounded-md transition-colors"
                    title="Refresh List"
                >
                    <RefreshCw size={14} className={loading && !actionLoading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {error ? (
                    <div className="p-6 text-center text-red-400 text-sm">
                        {error}
                    </div>
                ) : loading && services.length === 0 ? (
                    <div className="p-6 flex justify-center text-[var(--text-muted)]">
                        <RefreshCw size={20} className="animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-[var(--bg-sidebar)] z-10 shadow-sm">
                            <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                                <th className="px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2 font-medium">Unit Name</th>
                                <th className="px-4 py-2 font-medium">Description</th>
                                <th className="px-4 py-2 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredServices.map((service, i) => (
                                <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--hover-color)] transition-colors group">
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(service.active, service.sub)}
                                            <span className={`capitalize ${service.active === 'active' ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                                {service.active}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap font-medium text-[var(--text-main)]">
                                        {service.unit}
                                    </td>
                                    <td className="px-4 py-2 text-[var(--text-muted)] truncate max-w-[200px] md:max-w-md lg:max-w-lg" title={service.description}>
                                        {service.description || '-'}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleAction(service.unit, 'start')}
                                                disabled={actionLoading === service.unit || service.active === 'active'}
                                                className="p-1 rounded text-green-400 hover:bg-green-400/20 transition-colors disabled:opacity-30"
                                                title="Start"
                                            >
                                                <Play size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleAction(service.unit, 'stop')}
                                                disabled={actionLoading === service.unit || service.active !== 'active'}
                                                className="p-1 rounded text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-30"
                                                title="Stop"
                                            >
                                                <Square size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleAction(service.unit, 'restart')}
                                                disabled={actionLoading === service.unit}
                                                className="p-1 rounded text-blue-400 hover:bg-blue-400/20 transition-colors disabled:opacity-30"
                                                title="Restart"
                                            >
                                                <RotateCw size={14} className={actionLoading === service.unit ? "animate-spin" : ""} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredServices.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-[var(--text-muted)]">
                                        No services found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
