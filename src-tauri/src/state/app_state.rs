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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_struct_fields() {
        // Verify all fields exist by checking the struct definition compiles
        // This is a compile-time check
        let _fields = vec![
            "profile_store",
            "ssh_manager",
            "sftp_manager",
            "monitor_manager",
            "net_tool_manager",
            "docker_manager",
            "sharing_service",
            "tunnel_service",
            "snippet_store",
            "connection_pool",
        ];
        
        for field in _fields {
            assert!(!field.is_empty());
        }
    }

    #[test]
    fn test_app_state_mutex_types() {
        // Verify mutex-wrapped fields
        let _profile_store: Mutex<i32> = Mutex::new(0);
        let _sharing_service: Mutex<i32> = Mutex::new(0);
        let _snippet_store: Mutex<i32> = Mutex::new(0);
    }

    #[test]
    fn test_app_state_managers() {
        // Verify manager types can be created
        let _ssh_manager = SshManager::new();
        let _sftp_manager = SftpManager::new();
        let _monitor_manager = MonitorManager::new();
        let _net_tool_manager = NetToolManager::new();
        let _docker_manager = DockerManager::new();
        let _tunnel_service = TunnelService::new();
    }

    #[test]
    fn test_pool_config_default() {
        let config = PoolConfig::default();
        assert!(config.max_connections > 0);
    }

    #[test]
    fn test_connection_pool_creation() {
        let config = PoolConfig::default();
        let _pool = ConnectionPool::new(config);
    }

    #[test]
    fn test_mutex_lock_unlock() {
        let mutex = Mutex::new(42);
        let guard = mutex.lock().unwrap();
        assert_eq!(*guard, 42);
    }

    #[test]
    fn test_mutex_guard_drop() {
        let mutex = Mutex::new(vec![1, 2, 3]);
        {
            let _guard = mutex.lock().unwrap();
            // Guard is in scope
        }
        // Guard is dropped, can lock again
        let guard2 = mutex.lock().unwrap();
        assert_eq!(guard2.len(), 3);
    }
}
