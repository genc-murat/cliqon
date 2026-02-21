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

    closeSftp: async (sessionId: string): Promise<void> => {
        return await invoke('close_sftp', { sessionId });
    }
};
