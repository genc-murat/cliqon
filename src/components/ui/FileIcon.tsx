import React from 'react';
import { 
    FileText, 
    FileJson, 
    FileCode, 
    FileImage, 
    Archive, 
    Database, 
    Settings, 
    Terminal, 
    Shield, 
    Globe, 
    Package, 
    File,
    Folder,
    Lock,
    Binary,
    ScrollText,
    Key,
    FileType
} from 'lucide-react';

interface FileIconProps {
    name: string;
    isDir: boolean;
    size?: number;
    className?: string;
}

interface IconConfig {
    icon: any;
    color?: string;
}

const extensionMap: Record<string, IconConfig> = {
    // Images
    'jpg': { icon: FileImage, color: 'text-purple-400' },
    'jpeg': { icon: FileImage, color: 'text-purple-400' },
    'png': { icon: FileImage, color: 'text-purple-400' },
    'gif': { icon: FileImage, color: 'text-purple-400' },
    'svg': { icon: FileImage, color: 'text-orange-400' },
    'webp': { icon: FileImage, color: 'text-purple-400' },
    'ico': { icon: FileImage, color: 'text-amber-400' },
    
    // Archives
    'zip': { icon: Archive, color: 'text-yellow-600' },
    'tar': { icon: Archive, color: 'text-yellow-600' },
    'gz': { icon: Archive, color: 'text-yellow-600' },
    '7z': { icon: Archive, color: 'text-yellow-600' },
    'rar': { icon: Archive, color: 'text-yellow-600' },
    'bz2': { icon: Archive, color: 'text-yellow-600' },
    'xz': { icon: Archive, color: 'text-yellow-600' },
    
    // Code
    'js': { icon: FileCode, color: 'text-yellow-400' },
    'ts': { icon: FileCode, color: 'text-blue-400' },
    'jsx': { icon: FileCode, color: 'text-blue-300' },
    'tsx': { icon: FileCode, color: 'text-blue-500' },
    'vue': { icon: FileCode, color: 'text-green-500' },
    'svelte': { icon: FileCode, color: 'text-orange-500' },
    'py': { icon: FileCode, color: 'text-blue-500' },
    'rs': { icon: FileCode, color: 'text-orange-600' },
    'go': { icon: FileCode, color: 'text-cyan-500' },
    'c': { icon: FileCode, color: 'text-blue-600' },
    'cpp': { icon: FileCode, color: 'text-blue-700' },
    'h': { icon: FileCode, color: 'text-purple-500' },
    'hpp': { icon: FileCode, color: 'text-purple-500' },
    'java': { icon: FileCode, color: 'text-red-500' },
    'rb': { icon: FileCode, color: 'text-red-600' },
    'php': { icon: FileCode, color: 'text-indigo-400' },
    'sh': { icon: Terminal, color: 'text-green-500' },
    'bash': { icon: Terminal, color: 'text-green-500' },
    'zsh': { icon: Terminal, color: 'text-green-500' },
    'fish': { icon: Terminal, color: 'text-green-500' },
    'bat': { icon: Terminal, color: 'text-green-500' },
    'cmd': { icon: Terminal, color: 'text-green-500' },
    'html': { icon: Globe, color: 'text-orange-500' },
    'css': { icon: FileCode, color: 'text-blue-400' },
    'scss': { icon: FileCode, color: 'text-pink-400' },
    'less': { icon: FileCode, color: 'text-blue-600' },
    
    // Database
    'sql': { icon: Database, color: 'text-pink-500' },
    'db': { icon: Database, color: 'text-blue-400' },
    'sqlite': { icon: Database, color: 'text-blue-400' },
    
    // Data & Config
    'json': { icon: FileJson, color: 'text-yellow-500' },
    'jsonc': { icon: FileJson, color: 'text-yellow-500' },
    'json5': { icon: FileJson, color: 'text-yellow-500' },
    'yml': { icon: Settings, color: 'text-purple-400' },
    'yaml': { icon: Settings, color: 'text-purple-400' },
    'toml': { icon: Settings, color: 'text-stone-400' },
    'xml': { icon: FileCode, color: 'text-orange-400' },
    'md': { icon: FileText, color: 'text-blue-400' },
    'mdx': { icon: FileText, color: 'text-blue-500' },
    'txt': { icon: FileText, color: 'text-stone-400' },
    'log': { icon: ScrollText, color: 'text-stone-500' },
    'err': { icon: ScrollText, color: 'text-red-400' },
    'out': { icon: ScrollText, color: 'text-stone-500' },
    'pdf': { icon: FileType, color: 'text-red-500' },
    
    // Security & SSH
    'env': { icon: Lock, color: 'text-yellow-500' },
    'key': { icon: Key, color: 'text-amber-400' },
    'pub': { icon: Key, color: 'text-amber-200' },
    'pem': { icon: Key, color: 'text-amber-400' },
    
    // Git & Docker
    'gitignore': { icon: Shield, color: 'text-orange-600' },
    'dockerignore': { icon: Shield, color: 'text-blue-400' },
    
    // Binary/Exec
    'exe': { icon: Binary, color: 'text-green-400' },
    'bin': { icon: Binary, color: 'text-stone-400' },
    'app': { icon: Binary, color: 'text-stone-400' },
    'dll': { icon: Settings, color: 'text-stone-400' },
    'wasm': { icon: Binary, color: 'text-purple-600' },
    
    // Package managers
    'lock': { icon: Lock, color: 'text-stone-400' },
};

const fileNameMap: Record<string, IconConfig> = {
    'Dockerfile': { icon: FileCode, color: 'text-blue-400' },
    'docker-compose.yml': { icon: FileCode, color: 'text-blue-500' },
    'docker-compose.yaml': { icon: FileCode, color: 'text-blue-500' },
    'Makefile': { icon: Settings, color: 'text-orange-400' },
    'package.json': { icon: Package, color: 'text-red-400' },
    'package-lock.json': { icon: Lock, color: 'text-stone-400' },
    'Cargo.toml': { icon: Package, color: 'text-orange-500' },
    'Cargo.lock': { icon: Lock, color: 'text-stone-400' },
    '.env': { icon: Lock, color: 'text-yellow-500' },
    '.gitignore': { icon: Shield, color: 'text-orange-600' },
    '.dockerignore': { icon: Shield, color: 'text-blue-400' },
    'LICENSE': { icon: ScrollText, color: 'text-stone-400' },
    'README.md': { icon: FileText, color: 'text-blue-400' },
};

export const FileIcon: React.FC<FileIconProps> = ({ name, isDir, size = 14, className = '' }) => {
    if (isDir) {
        return <Folder size={size} className={`${className} text-[var(--accent-color)]`} fill="currentColor" fillOpacity={0.2} />;
    }

    const lowerName = name.toLowerCase();
    
    // Check exact file name matches first
    if (fileNameMap[name]) {
        const { icon: Icon, color } = fileNameMap[name];
        return <Icon size={size} className={`${className} ${color || 'text-[var(--text-muted)]'}`} />;
    }

    // Check extensions
    const ext = lowerName.split('.').pop();
    if (ext && extensionMap[ext]) {
        const { icon: Icon, color } = extensionMap[ext];
        return <Icon size={size} className={`${className} ${color || 'text-[var(--text-muted)]'}`} />;
    }

    // Default file icon
    return <File size={size} className={`${className} text-[var(--text-muted)]`} />;
};
