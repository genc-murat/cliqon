import React, { useState, useEffect } from 'react';
import { Shield, X, Save } from 'lucide-react';
import { TunnelConfig, TunnelType } from '../../types/connection';

interface TunnelConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: TunnelConfig) => Promise<void>;
    initialConfig?: TunnelConfig;
}

export const TunnelConfigModal: React.FC<TunnelConfigModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialConfig
}) => {
    const [name, setName] = useState('');
    const [tunnelType, setTunnelType] = useState<TunnelType>('Local');
    const [localPort, setLocalPort] = useState<string>('8080');
    const [remoteHost, setRemoteHost] = useState<string>('127.0.0.1');
    const [remotePort, setRemotePort] = useState<string>('80');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialConfig) {
                setName(initialConfig.name);
                setTunnelType(initialConfig.tunnel_type);
                setLocalPort(initialConfig.local_port.toString());
                setRemoteHost(initialConfig.remote_host || '127.0.0.1');
                setRemotePort(initialConfig.remote_port?.toString() || '80');
            } else {
                setName('');
                setTunnelType('Local');
                setLocalPort('8080');
                setRemoteHost('127.0.0.1');
                setRemotePort('80');
            }
            setError(null);
            setLoading(false);
        }
    }, [isOpen, initialConfig]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const config: TunnelConfig = {
                id: initialConfig?.id || crypto.randomUUID(),
                name: name.trim() || 'New Tunnel',
                tunnel_type: tunnelType,
                local_port: parseInt(localPort) || 8080,
                remote_host: remoteHost.trim() || null,
                remote_port: parseInt(remotePort) || null,
            };

            await onSave(config);
            onClose();
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
                        <Shield className="text-[var(--accent-color)]" size={18} />
                        {initialConfig ? 'Edit Tunnel' : 'Add Tunnel'}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    {error && (
                        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Name
                        </label>
                        <input
                            type="text"
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none"
                            placeholder="e.g. Postgres DB"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Type
                        </label>
                        <div className="grid grid-cols-3 gap-2 bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
                            {(['Local', 'Remote', 'Dynamic'] as TunnelType[]).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setTunnelType(type)}
                                    className={`
                                        py-1.5 text-xs font-medium rounded-md transition-colors
                                        ${tunnelType === type
                                            ? 'bg-[var(--accent-color)] text-white shadow-sm'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}
                                    `}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Local Port
                        </label>
                        <input
                            type="number"
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none"
                            placeholder="8080"
                            value={localPort}
                            onChange={(e) => setLocalPort(e.target.value)}
                            required
                        />
                    </div>

                    {tunnelType !== 'Dynamic' && (
                        <div className="grid grid-cols-[1fr_100px] gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Remote Host
                                </label>
                                <input
                                    type="text"
                                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none"
                                    placeholder="127.0.0.1"
                                    value={remoteHost}
                                    onChange={(e) => setRemoteHost(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Remote Port
                                </label>
                                <input
                                    type="number"
                                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none"
                                    placeholder="80"
                                    value={remotePort}
                                    onChange={(e) => setRemotePort(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-[var(--text-subtext)] hover:text-[var(--text-main)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Save size={14} />
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
