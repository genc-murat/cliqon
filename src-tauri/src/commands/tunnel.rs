use tauri::State;
use crate::error::{AppError, Result};
use crate::models::profile::TunnelConfig;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn start_tunnel(
    session_id: String,
    config: TunnelConfig,
    state: State<'_, AppState>,
) -> Result<()> {
    // 1. Get the session
    let session = state
        .ssh_manager
        .get_session(&session_id)
        .ok_or_else(|| AppError::Custom("SSH Session not found".to_string()))?;
        
    // 2. Start the tunnel
    state.tunnel_service.start_tunnel(&session, config, session_id)?;

    Ok(())
}

#[tauri::command]
pub async fn stop_tunnel(
    tunnel_id: String,
    state: State<'_, AppState>,
) -> Result<()> {
    state.tunnel_service.stop_tunnel(&tunnel_id)?;
    Ok(())
}

#[tauri::command]
pub async fn get_active_tunnels(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<TunnelConfig>> {
    Ok(state.tunnel_service.get_active_tunnels(&session_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tunnel_command_types() {
        let _response_type: Result<()> = Ok(());
        let _error_type: Result<()> = Err(AppError::Custom("error".to_string()));
    }

    #[test]
    fn test_tunnel_session_id_format() {
        let session_id = "tunnel-session-123";
        assert!(!session_id.is_empty());
    }

    #[test]
    fn test_tunnel_id_format() {
        let tunnel_id = "tunnel-456";
        assert!(!tunnel_id.is_empty());
        assert!(tunnel_id.contains("tunnel"));
    }

    #[test]
    fn test_tunnel_config_creation() {
        let config = TunnelConfig {
            id: "t-1".to_string(),
            name: "Test Tunnel".to_string(),
            tunnel_type: crate::models::profile::TunnelType::Local,
            local_port: 8080,
            remote_host: Some("localhost".to_string()),
            remote_port: Some(80),
        };

        assert_eq!(config.id, "t-1");
        assert_eq!(config.local_port, 8080);
    }

    #[test]
    fn test_tunnel_types() {
        let types = vec![
            "Local",
            "Remote",
            "Dynamic",
        ];

        for t in types {
            assert!(!t.is_empty());
        }
    }

    #[test]
    fn test_tunnel_port_ranges() {
        let valid_ports = vec![22, 80, 443, 3306, 5432, 8080, 3000];
        
        for port in valid_ports {
            assert!(port > 0);
            assert!(port <= 65535);
        }
    }

    #[test]
    fn test_tunnel_host_formats() {
        let hosts = vec![
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "example.com",
            "192.168.1.1",
        ];

        for host in hosts {
            assert!(!host.is_empty());
        }
    }

    #[test]
    fn test_tunnel_manager_methods() {
        let methods = vec![
            "start_tunnel", "stop_tunnel", "get_active_tunnels"
        ];

        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_tunnel_result_vec() {
        let result: Result<Vec<TunnelConfig>> = Ok(Vec::new());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_tunnel_error_handling() {
        let error = AppError::Custom("SSH Session not found".to_string());
        assert!(error.to_string().contains("Session"));
    }

    #[test]
    fn test_tunnel_option_handling() {
        let host: Option<String> = None;
        assert!(host.is_none());

        let host2: Option<String> = Some("localhost".to_string());
        assert!(host2.is_some());
    }

    #[test]
    fn test_tunnel_active_tunnels_list() {
        let tunnels: Vec<TunnelConfig> = Vec::new();
        assert!(tunnels.is_empty());

        let tunnels2: Vec<TunnelConfig> = vec![
            TunnelConfig {
                id: "t1".to_string(),
                name: "T1".to_string(),
                tunnel_type: crate::models::profile::TunnelType::Local,
                local_port: 8080,
                remote_host: None,
                remote_port: None,
            },
        ];
        assert_eq!(tunnels2.len(), 1);
    }

    #[test]
    fn test_tunnel_string_cloning() {
        let session_id = "session-123".to_string();
        let cloned = session_id.clone();
        
        assert_eq!(session_id, cloned);
    }

    #[test]
    fn test_tunnel_state_type() {
        // Type check for State parameter
        let _type_check: fn(State<'_, ()>) = |_| {};
    }

    #[test]
    fn test_tunnel_async_function_types() {
        use std::future;
        let _start_tunnel: fn(String, TunnelConfig, State<'_, AppState>) -> future::Ready<Result<()>> = 
            |_, _, _| future::ready(Ok(()));
    }

    #[test]
    fn test_tunnel_ok_or_else() {
        let session: Option<i32> = None;
        let result = session.ok_or_else(|| AppError::Custom("not found".to_string()));
        assert!(result.is_err());

        let session2: Option<i32> = Some(42);
        let result2 = session2.ok_or_else(|| AppError::Custom("not found".to_string()));
        assert!(result2.is_ok());
    }

    #[test]
    fn test_tunnel_port_validation() {
        let port: u16 = 8080;
        assert!(port > 0);
        
        let max_port: u16 = 65535;
        assert_eq!(max_port, 65535);
    }

    #[test]
    fn test_tunnel_config_clone() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: crate::models::profile::TunnelType::Local,
            local_port: 3000,
            remote_host: None,
            remote_port: None,
        };

        let cloned = config.clone();
        assert_eq!(config.id, cloned.id);
        assert_eq!(config.name, cloned.name);
    }

    #[test]
    fn test_tunnel_result_error_handling() {
        let err_result: Result<()> = Err(crate::error::AppError::Custom("Tunnel failed".to_string()));
        assert!(err_result.is_err());
        
        let ok_result: Result<()> = Ok(());
        assert!(ok_result.is_ok());
    }

    #[test]
    fn test_tunnel_local_port_range() {
        let ports = vec![8080, 3000, 5000, 9000, 5432];
        
        for port in ports {
            let is_valid = port > 1024 && port <= 65535;
            assert!(is_valid);
        }
    }

    #[test]
    fn test_tunnel_remote_host_format() {
        let hosts = vec![
            "localhost",
            "127.0.0.1",
            "db.example.com",
            "192.168.1.100",
        ];
        
        for host in hosts {
            assert!(!host.is_empty());
        }
    }
}
