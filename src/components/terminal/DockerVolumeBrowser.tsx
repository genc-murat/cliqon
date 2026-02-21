import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, ArrowLeft, RefreshCw, AlertCircle, File, Folder, Link as LinkIcon, ChevronRight } from 'lucide-react';
import { SshProfile } from '../../types/connection';
import { api } from '../../services/api';

interface VolumeFile {
    path: string;
    name: string;
    type: string;
    size: number;
    mtime: number;
}

interface DockerVolumeBrowserProps {
    profile: SshProfile;
    volumeName: string;
    onBack: () => void;
}

export const DockerVolumeBrowser: React.FC<DockerVolumeBrowserProps> = ({ profile, volumeName, onBack }) => {
    const [currentPath, setCurrentPath] = useState<string>('/');
    const [files, setFiles] = useState<VolumeFile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFiles = useCallback(async (path: string) => {
        try {
            setLoading(true);
            setError(null);

            // Expected output format lines: /data/filename|regular file|1024|1688538332
            const rawOutput = await api.getDockerVolumeFiles(profile, volumeName, path);
            const lines = rawOutput.split('\n').filter(Boolean);

            const parsedFiles: VolumeFile[] = [];
            for (const line of lines) {
                const parts = line.split('|');
                if (parts.length >= 4) {
                    const fullPath = parts[0]; // /data/filename

                    // Skip the current directory itself which stat might return
                    const expectedDirPath = path === '/' ? '/data' : `/data${path}`;
                    if (fullPath === expectedDirPath) continue;

                    const name = fullPath.substring(expectedDirPath.length).replace(/^\//, '');
                    if (!name) continue;

                    parsedFiles.push({
                        path: fullPath,
                        name,
                        type: parts[1].toLowerCase(),
                        size: parseInt(parts[2], 10) || 0,
                        mtime: parseInt(parts[3], 10) || 0
                    });
                }
            }

            // Sort: directories first, then alphabetically
            parsedFiles.sort((a, b) => {
                const aIsDir = a.type.includes('directory');
                const bIsDir = b.type.includes('directory');
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.name.localeCompare(b.name);
            });

            setFiles(parsedFiles);
        } catch (err: any) {
            console.error(err);
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [profile, volumeName]);

    useEffect(() => {
        fetchFiles(currentPath);
    }, [currentPath, fetchFiles]);

    const handleNavigate = (file: VolumeFile) => {
        if (file.type.includes('directory')) {
            const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
            setCurrentPath(newPath);
        }
    };

    const handleNavigateUp = () => {
        if (currentPath === '/') return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/') || '/');
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp * 1000).toLocaleString();
    };

    const getFileIcon = (type: string) => {
        if (type.includes('directory')) return <Folder size={14} className="text-[#FBBF24]" />;
        if (type.includes('link')) return <LinkIcon size={14} className="text-[#3B82F6]" />;
        return <File size={14} className="text-[#9CA3AF]" />;
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-sidebar)]">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-[var(--hover-color)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                        title="Back to Volumes"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <HardDrive size={16} className="text-[var(--accent-color)]" />
                            <h3 className="text-sm font-bold text-[var(--text-main)] truncate max-w-[300px]" title={volumeName}>
                                {volumeName}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] font-mono text-[var(--text-muted)]">
                            <span className="cursor-pointer hover:text-[var(--accent-color)] hover:underline" onClick={() => setCurrentPath('/')}>/</span>
                            {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((part, idx, arr) => {
                                const pathToHere = '/' + arr.slice(0, idx + 1).join('/');
                                return (
                                    <React.Fragment key={idx}>
                                        <ChevronRight size={10} className="opacity-50" />
                                        <span
                                            className="cursor-pointer hover:text-[var(--accent-color)] hover:underline"
                                            onClick={() => setCurrentPath(pathToHere)}
                                        >
                                            {part}
                                        </span>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => fetchFiles(currentPath)}
                    disabled={loading}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded-lg transition-colors"
                    title="Refresh Directory"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col">
                {error ? (
                    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                ) : loading && files.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                        <RefreshCw size={24} className="animate-spin text-[var(--accent-color)]" />
                        <span className="text-sm font-medium">Loading files...</span>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] Select-none">
                                <tr>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Size</th>
                                    <th className="px-4 py-3 font-medium uppercase tracking-wider text-[var(--text-muted)]">Modified</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {currentPath !== '/' && (
                                    <tr
                                        className="hover:bg-[var(--hover-color)]/30 transition-colors cursor-pointer"
                                        onClick={handleNavigateUp}
                                    >
                                        <td className="px-4 py-3 flex items-center gap-2" colSpan={3}>
                                            <Folder size={14} className="text-[#FBBF24]" />
                                            <span className="font-medium text-[var(--text-main)]">..</span>
                                        </td>
                                    </tr>
                                )}

                                {files.length === 0 && currentPath === '/' ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-muted)] opacity-50">
                                            Volume is empty
                                        </td>
                                    </tr>
                                ) : (
                                    files.map((file, idx) => (
                                        <tr
                                            key={idx}
                                            className={`hover:bg-[var(--hover-color)]/30 transition-colors group ${file.type.includes('directory') ? 'cursor-pointer' : ''}`}
                                            onClick={() => handleNavigate(file)}
                                        >
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                {getFileIcon(file.type)}
                                                <span className={`font-mono ${file.type.includes('directory') ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                                                    {file.name}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                                                {!file.type.includes('directory') ? formatSize(file.size) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                                                {formatDate(file.mtime)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
