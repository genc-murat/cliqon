use crate::services::connection_pool::{ConnectionPool, PoolConfig};
use crate::services::docker::DockerManager;
use crate::services::monitor::MonitorManager;
use crate::services::net_tools::NetToolManager;
use crate::services::sftp::SftpManager;
use crate::services::sharing::SharingService;
use crate::services::snippet::SnippetStore;
use crate::services::ssh::SshManager;
use crate::services::store::ProfileStore;
use crate::services::tunnel::TunnelService;
use std::sync::Mutex;
use tauri::AppHandle;

pub struct AppState {
    pub profile_store: Mutex<ProfileStore>,
    pub ssh_manager: SshManager,
    pub sftp_manager: SftpManager,
    pub monitor_manager: MonitorManager,
    pub net_tool_manager: NetToolManager,
    pub docker_manager: DockerManager,
    pub sharing_service: Mutex<SharingService>,
    pub tunnel_service: TunnelService,
    pub snippet_store: Mutex<SnippetStore>,
    pub connection_pool: ConnectionPool,
}

impl AppState {
    pub fn new(app_handle: &AppHandle) -> Self {
        let pool_config = PoolConfig::default();

        Self {
            profile_store: Mutex::new(ProfileStore::new(app_handle)),
            ssh_manager: SshManager::new(),
            sftp_manager: SftpManager::new(),
            monitor_manager: MonitorManager::new(),
            net_tool_manager: NetToolManager::new(),
            docker_manager: DockerManager::new(),
            sharing_service: Mutex::new(SharingService::new()),
            tunnel_service: TunnelService::new(),
            snippet_store: Mutex::new(SnippetStore::new(app_handle)),
            connection_pool: ConnectionPool::new(pool_config),
        }
    }
}
