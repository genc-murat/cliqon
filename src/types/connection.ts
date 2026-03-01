export type AuthMethod = 'Password' | 'PrivateKey' | 'Agent';

export interface Snippet {
    id: string;
    name: string;
    command: string;
    folder?: string | null;
    auto_run: boolean;
    description?: string;
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
    tunnels?: TunnelConfig[];
    is_favorite?: boolean;
    color?: string;
    last_used?: number;
}

export type TunnelType = 'Local' | 'Remote' | 'Dynamic';

export interface TunnelConfig {
    id: string;
    name: string;
    tunnel_type: TunnelType;
    local_port: number;
    remote_host: string | null;
    remote_port: number | null;
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
