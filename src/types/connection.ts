export type AuthMethod = 'Password' | 'PrivateKey' | 'Agent';

export interface Snippet {
    id: string;
    name: string;
    command: string;
}

export interface SshProfile {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    auth_method: AuthMethod;
    category: string | null;
    private_key_path?: string;
    snippets?: Snippet[];
    is_favorite?: boolean;
    color?: string;
}

export interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    modified_at: number;
}

export interface FileProperties {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    modified_at: number;
    permissions: number;
    permissions_display: string;
    uid: number;
    gid: number;
}
