import React, { useState, useRef } from 'react';
import { Upload, X, Shield, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type ImportSource = 'mobaxterm' | 'termius';

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ count: number; source: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);

    if (!isOpen) return null;

    const handleSourceSelect = (source: ImportSource) => {
        setSelectedSource(source);
        // Small delay to ensure input accept is updated if needed (though it's handled by state)
        setTimeout(() => fileInputRef.current?.click(), 10);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedSource) return;

        setLoading(true);
        setError(null);
        setResult(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            try {
                const count = await api.importProfiles(selectedSource, content);
                setResult({ count, source: selectedSource });
                onSuccess();
            } catch (err: any) {
                setError(typeof err === 'string' ? err : err.message || 'Import failed');
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.onerror = () => {
            setError('Failed to read file');
            setLoading(false);
        };

        reader.readAsText(file);
    };

    const reset = () => {
        setResult(null);
        setError(null);
        setSelectedSource(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg w-full max-w-md shadow-2xl p-6 transition-colors duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-[var(--text-main)] flex items-center gap-2">
                        <Upload size={20} />
                        Import Connections
                    </h2>
                    <button onClick={reset} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-[200px] flex flex-col justify-center">
                    {result ? (
                        <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 size={48} className="mx-auto text-green-500" />
                            <div>
                                <h3 className="text-lg font-medium text-[var(--text-main)]">Import Successful</h3>
                                <p className="text-sm text-[var(--text-muted)] mt-1">
                                    Successfully imported {result.count} connections from {result.source === 'mobaxterm' ? 'MobaXterm' : 'Termius'}.
                                </p>
                            </div>
                            <button
                                onClick={reset}
                                className="w-full mt-4 py-2 bg-[var(--accent-color)] text-white rounded-md hover:opacity-90 transition-all font-medium"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                    Choose the application you want to import your SSH connections from.
                                    <span className="block mt-2 font-medium text-[var(--text-muted)] flex items-center gap-1">
                                        <AlertCircle size={12} /> Passwords are not imported for security.
                                    </span>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleSourceSelect('mobaxterm')}
                                    disabled={loading}
                                    className="flex flex-col items-center gap-3 p-6 border border-[var(--border-color)] rounded-xl hover:bg-[var(--hover-color)] hover:border-[var(--accent-color)] transition-all group relative overflow-hidden"
                                >
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300">
                                        <Shield size={24} />
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-sm font-semibold text-[var(--text-main)]">MobaXterm</span>
                                        <span className="text-[10px] text-[var(--text-muted)]">.mxtsessions</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleSourceSelect('termius')}
                                    disabled={loading}
                                    className="flex flex-col items-center gap-3 p-6 border border-[var(--border-color)] rounded-xl hover:bg-[var(--hover-color)] hover:border-[var(--accent-color)] transition-all group relative overflow-hidden"
                                >
                                    <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-300">
                                        <FileJson size={24} />
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-sm font-semibold text-[var(--text-main)]">Termius</span>
                                        <span className="text-[10px] text-[var(--text-muted)]">JSON Export</span>
                                    </div>
                                </button>
                            </div>

                            {error && (
                                <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-xs text-red-500 animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span className="leading-tight">{error}</span>
                                </div>
                            )}

                            {loading && (
                                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                                    <div className="w-4 h-4 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
                                    Importing connections...
                                </div>
                            )}
                        </>
                    )}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept={selectedSource === 'mobaxterm' ? '.mxtsessions,.ini,.txt' : '.json'}
                />
            </div>
        </div>
    );
};
