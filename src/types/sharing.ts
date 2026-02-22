export interface PeerInfo {
    id: string;
    display_name: string;
    ip: string;
    port: number;
    last_seen: number;
}

export interface ShareableSnippet {
    id: string;
    name: string;
    command: string;
    folder: string | null;
    auto_run: boolean;
    description: string | null;
}

export interface ShareableProfile {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    auth_method: string;
    category: string | null;
    private_key_path?: string;
    secret?: string;
    is_favorite?: boolean;
    color?: string;
}

export interface PendingShare {
    id: string;
    from_name: string;
    from_ip: string;
    profiles: ShareableProfile[];
    snippets: ShareableSnippet[];
    received_at: number;
}

export interface SharingStatus {
    active: boolean;
    display_name: string;
    local_ip: string;
    http_port: number;
    peer_count: number;
}
