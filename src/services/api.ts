import { invoke } from '@tauri-apps/api/core';
import { SshProfile } from '../types/connection';

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
    }
};
