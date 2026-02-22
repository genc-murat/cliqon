import { invoke } from '@tauri-apps/api/core';
import { SshProfile } from '../types/connection';
import { SharingStatus, PeerInfo, PendingShare } from '../types/sharing';

export const api = {
    getProfiles: async (): Promise<SshProfile[]> => {
        return await invoke<SshProfile[]>('get_profiles');
    },

    saveProfile: async (profile: SshProfile, secret: string | null = null): Promise<void> => {
        return await invoke('save_profile', { profile, secret });
    },

    deleteProfile: async (id: string): Promise<void> => {
        return await invoke('delete_profile', { id });
    },

    getProfileSecret: async (id: string): Promise<string | null> => {
        return await invoke<string | null>('get_profile_secret', { id });
    },

    connectSsh: async (profile: SshProfile, sessionId: string): Promise<void> => {
        return await invoke('connect_ssh', { profile, sessionId });
    },

    writeToPty: async (sessionId: string, data: number[]): Promise<void> => {
        return await invoke('write_to_pty', { sessionId, data });
    },

    resizePty: async (sessionId: string, cols: number, rows: number): Promise<void> => {
        return await invoke('resize_pty', { sessionId, cols, rows });
    },

    closePty: async (sessionId: string): Promise<void> => {
        return await invoke('close_pty', { sessionId });
    },

    connectSftp: async (profile: SshProfile, sessionId: string): Promise<void> => {
        return await invoke('connect_sftp', { profile, sessionId });
    },

    listSftpDir: async (sessionId: string, path: string): Promise<void> => {
        return await invoke('list_sftp_dir', { sessionId, path });
    },

    uploadSftp: async (sessionId: string, localPath: string, remotePath: string): Promise<void> => {
        return await invoke('upload_sftp', { sessionId, localPath, remotePath });
    },

    downloadSftp: async (sessionId: string, remotePath: string, localPath: string): Promise<void> => {
        return await invoke('download_sftp', { sessionId, remotePath, localPath });
    },

    downloadMultiZipSftp: async (sessionId: string, remotePaths: string[], localZip: string): Promise<void> => {
        return await invoke('download_multi_zip_sftp', { sessionId, remotePaths, localZip });
    },

    renameSftp: async (sessionId: string, oldPath: string, newPath: string): Promise<void> => {
        return await invoke('rename_sftp', { sessionId, oldPath, newPath });
    },

    deleteSftp: async (sessionId: string, path: string, isDir: boolean): Promise<void> => {
        return await invoke('delete_sftp', { sessionId, path, isDir });
    },

    statSftp: async (sessionId: string, path: string): Promise<void> => {
        return await invoke('stat_sftp', { sessionId, path });
    },

    chmodSftp: async (sessionId: string, path: string, mode: number): Promise<void> => {
        return await invoke('chmod_sftp', { sessionId, path, mode });
    },

    readSftpFile: async (sessionId: string, path: string): Promise<void> => {
        return await invoke('read_sftp_file', { sessionId, path });
    },

    writeSftpFile: async (sessionId: string, path: string, content: string): Promise<void> => {
        return await invoke('write_sftp_file', { sessionId, path, content });
    },

    sudoReadFile: async (profile: SshProfile, path: string): Promise<string> => {
        return await invoke<string>('sudo_read_file', { profile, path });
    },

    sudoWriteFile: async (profile: SshProfile, path: string, content: string): Promise<void> => {
        return await invoke('sudo_write_file', { profile, path, content });
    },

    closeSftp: async (sessionId: string): Promise<void> => {
        return await invoke('close_sftp', { sessionId });
    },

    startSftpWatch: async (sessionId: string, path: string): Promise<void> => {
        return await invoke('start_sftp_watch', { sessionId, path });
    },

    stopSftpWatch: async (sessionId: string): Promise<void> => {
        return await invoke('stop_sftp_watch', { sessionId });
    },

    startMonitor: async (profile: SshProfile, sessionId: string): Promise<void> => {
        return await invoke('start_monitor', { profile, sessionId });
    },

    stopMonitor: async (sessionId: string): Promise<void> => {
        return await invoke('stop_monitor', { sessionId });
    },

    runNetTool: async (profile: SshProfile, sessionId: string, toolType: string, target: string): Promise<string> => {
        return await invoke<string>('run_net_tool', { profile, sessionId, toolType, target });
    },

    getDockerContainers: async (profile: SshProfile): Promise<string> => {
        return await invoke<string>('get_docker_containers', { profile });
    },

    startDockerContainer: async (profile: SshProfile, containerId: string): Promise<string> => {
        return await invoke<string>('start_docker_container', { profile, containerId });
    },

    stopDockerContainer: async (profile: SshProfile, containerId: string): Promise<string> => {
        return await invoke<string>('stop_docker_container', { profile, containerId });
    },

    restartDockerContainer: async (profile: SshProfile, containerId: string): Promise<string> => {
        return await invoke<string>('restart_docker_container', { profile, containerId });
    },

    getDockerStats: async (profile: SshProfile): Promise<string> => {
        return await invoke<string>('get_docker_stats', { profile });
    },

    dockerSystemPrune: async (profile: SshProfile): Promise<string> => {
        return await invoke<string>('docker_system_prune', { profile });
    },

    readDockerCompose: async (profile: SshProfile, path: string): Promise<string> => {
        return await invoke<string>('read_docker_compose', { profile, path });
    },

    getDockerVolumes: async (profile: SshProfile): Promise<string> => {
        return await invoke<string>('get_docker_volumes', { profile });
    },

    getDockerVolumeFiles: async (profile: SshProfile, volumeName: string, innerPath: string): Promise<string> => {
        return await invoke<string>('get_docker_volume_files', { profile, volumeName, innerPath });
    },

    getSystemServices: async (profile: SshProfile): Promise<string> => {
        return await invoke<string>('get_system_services', { profile });
    },

    manageService: async (profile: SshProfile, action: string, service: string): Promise<string> => {
        return await invoke<string>('manage_service', { profile, action, service });
    },

    startLogTail: async (profile: SshProfile, path: string, sessionId: string): Promise<void> => {
        return await invoke('start_log_tail', { profile, path, sessionId });
    },

    stopLogTail: async (sessionId: string): Promise<void> => {
        return await invoke('stop_log_tail', { sessionId });
    },

    importProfiles: async (source: string, content: string): Promise<number> => {
        return await invoke<number>('import_profiles', { source, content });
    },

    // ─── Sharing API ────────────────────────────────────────

    startSharing: async (): Promise<SharingStatus> => {
        return await invoke<SharingStatus>('start_sharing');
    },

    stopSharing: async (): Promise<SharingStatus> => {
        return await invoke<SharingStatus>('stop_sharing');
    },

    getSharingStatus: async (): Promise<SharingStatus> => {
        return await invoke<SharingStatus>('get_sharing_status');
    },

    setDisplayName: async (name: string): Promise<void> => {
        return await invoke('set_sharing_display_name', { name });
    },

    getDiscoveredPeers: async (): Promise<PeerInfo[]> => {
        return await invoke<PeerInfo[]>('get_discovered_peers');
    },

    shareItemsWithPeer: async (peerId: string, profileIds: string[], snippetIds: string[]): Promise<string> => {
        return await invoke<string>('share_items_with_peer', { peerId, profileIds, snippetIds });
    },

    getPendingShares: async (): Promise<PendingShare[]> => {
        return await invoke<PendingShare[]>('get_pending_shares');
    },

    acceptShare: async (shareId: string): Promise<number> => {
        return await invoke<number>('accept_share', { shareId });
    },

    rejectShare: async (shareId: string): Promise<void> => {
        return await invoke('reject_share', { shareId });
    },

    pingPeer: async (ip: string, port: number): Promise<PeerInfo> => {
        return await invoke<PeerInfo>('ping_peer', { ip, port });
    },
};

