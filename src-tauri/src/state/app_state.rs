use std::sync::Mutex;
use crate::services::store::ProfileStore;
use crate::services::ssh::SshManager;
use crate::services::sftp::SftpManager;
use tauri::AppHandle;

pub struct AppState {
    pub profile_store: Mutex<ProfileStore>,
    pub ssh_manager: SshManager,
    pub sftp_manager: SftpManager,
}

impl AppState {
    pub fn new(app_handle: &AppHandle) -> Self {
        Self {
            profile_store: Mutex::new(ProfileStore::new(app_handle)),
            ssh_manager: SshManager::new(),
            sftp_manager: SftpManager::new(),
        }
    }
}
