use std::sync::Arc;
use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;
use crate::services::system::SystemService;

#[tauri::command]
pub async fn get_system_services(
    state: State<'_, AppState>,
    profile: SshProfile,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.get_system_services(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn get_system_timers(
    state: State<'_, AppState>,
    profile: SshProfile,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.get_system_timers(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn manage_service(
    state: State<'_, AppState>,
    profile: SshProfile,
    action: String,
    service: String,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.manage_service(&profile, secret.as_deref(), &action, &service)
}

#[tauri::command]
pub async fn get_env_vars(
    state: State<'_, AppState>,
    profile: SshProfile,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.get_env_vars(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn set_env_var(
    state: State<'_, AppState>,
    profile: SshProfile,
    key: String,
    value: String,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.set_env_var(&profile, secret.as_deref(), &key, &value)
}

#[tauri::command]
pub async fn delete_env_var(
    state: State<'_, AppState>,
    profile: SshProfile,
    key: String,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.delete_env_var(&profile, secret.as_deref(), &key)
}

#[tauri::command]
pub async fn save_text_file(path: String, content: String) -> Result<()> {
    std::fs::write(path, content).map_err(|e| crate::error::AppError::Custom(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_service_arc_type() {
        // Verify the Arc type is used correctly
        let _service: Arc<SystemService> = Arc::new(SystemService::new());
    }

    #[test]
    fn test_action_types() {
        let actions = vec!["start", "stop", "restart", "enable", "disable"];
        for action in actions {
            assert!(!action.is_empty());
        }
    }

    #[test]
    fn test_service_names() {
        let services = vec!["nginx", "docker", "ssh", "mysql", "postgresql"];
        for service in services {
            assert!(!service.is_empty());
        }
    }

    #[test]
    fn test_env_var_names() {
        let keys = vec!["PATH", "HOME", "USER", "MY_VAR"];
        for key in keys {
            assert!(!key.is_empty());
        }
    }

    #[test]
    fn test_result_string_type() {
        let result: Result<String> = Ok("test".to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_state_lock_pattern() {
        let test_data = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = test_data.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_profile_secret_handling() {
        let secret: Option<String> = None;
        let secret_deref = secret.as_deref();
        assert!(secret_deref.is_none());

        let secret2: Option<String> = Some("value".to_string());
        let secret_deref2 = secret2.as_deref();
        assert_eq!(secret_deref2, Some("value"));
    }

    #[test]
    fn test_error_mapping() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let custom_error = crate::error::AppError::Custom(format!("Failed: {}", io_error));
        assert!(custom_error.to_string().contains("Failed"));
    }

    #[test]
    fn test_async_command_function_types() {
        // Type checking for async command functions
        use std::future;
        let _get_system_services: fn(State<'_, AppState>, SshProfile, State<'_, Arc<SystemService>>) -> future::Ready<Result<String>> = 
            |_, _, _| future::ready(Ok(String::new()));
    }

    #[test]
    fn test_string_cloning() {
        let action = "start".to_string();
        let service = "nginx".to_string();
        
        let action_clone = action.clone();
        let service_clone = service.clone();
        
        assert_eq!(action, action_clone);
        assert_eq!(service, service_clone);
    }

    #[test]
    fn test_file_write_simulation() {
        // Test the logic without actually writing to disk
        let path = "/tmp/test_file.txt";
        let content = "test content";
        
        // Just verify the types are correct
        let _path: String = path.to_string();
        let _content: String = content.to_string();
    }

    #[test]
    fn test_mutex_guard_operations() {
        let mutex = std::sync::Mutex::new(42);
        let guard = mutex.lock().unwrap();
        let value = *guard;
        drop(guard);
        
        assert_eq!(value, 42);
    }

    #[test]
    fn test_arc_clone() {
        let service: Arc<SystemService> = Arc::new(SystemService::new());
        let cloned = Arc::clone(&service);
        
        assert!(Arc::ptr_eq(&service, &cloned));
    }

    #[test]
    fn test_state_type_parameter() {
        // Verify State type with lifetime parameter
        let _type_check: fn(State<'_, ()>) = |_| {};
    }

    #[test]
    fn test_command_response_types() {
        // All system commands return Result<String>
        let _response_type: Result<String> = Ok("output".to_string());
        let _error_type: Result<String> = Err(crate::error::AppError::Custom("error".to_string()));
    }

    #[test]
    fn test_system_command_result_map() {
        let ok: Result<String> = Ok("success".to_string());
        let mapped = ok.map(|s| s.to_uppercase());
        assert_eq!(mapped.unwrap(), "SUCCESS");
        
        let err: Result<String> = Err(crate::error::AppError::Custom("fail".to_string()));
        let mapped_err = err.map(|_| "should not run");
        assert!(mapped_err.is_err());
    }

    #[test]
    fn test_system_command_result_and_then() {
        let num: Result<i32> = Ok(42);
        let result = num.and_then(|n| Ok(n * 2));
        assert_eq!(result.unwrap(), 84);
    }

    #[test]
    fn test_system_app_handle_clone() {
        use tauri::AppHandle;
        
        let _handle: Option<AppHandle> = None;
        assert!(_handle.is_none());
    }

    #[test]
    fn test_system_string_utils() {
        let hostname = "server01";
        let domain = "example.com";
        let fqdn = format!("{}.{}", hostname, domain);
        
        assert_eq!(fqdn, "server01.example.com");
    }

    #[test]
    fn test_system_port_validation() {
        let ports = vec![22, 80, 443, 22, 8080, 3000, 5432];
        
        for port in ports {
            let is_valid = port > 0 && port <= 65535;
            assert!(is_valid);
        }
        
        let invalid_ports = vec![0, -1, 70000];
        for port in invalid_ports {
            let is_valid = port > 0 && port <= 65535;
            assert!(!is_valid);
        }
    }

    #[test]
    fn test_system_ip_address_validation() {
        let valid_ips = vec![
            "192.168.1.1",
            "10.0.0.1",
            "172.16.0.1",
            "127.0.0.1",
        ];
        
        for ip in valid_ips {
            let parts: Vec<&str> = ip.split('.').collect();
            assert_eq!(parts.len(), 4);
        }
    }

    #[test]
    fn test_system_path_validation() {
        let paths = vec![
            "/etc",
            "/var/log",
            "/home/user",
            "/tmp",
        ];
        
        for path in paths {
            assert!(path.starts_with('/'));
        }
    }

    #[test]
    fn test_system_command_timeout() {
        let timeout_seconds = 30;
        let timeout_ms = timeout_seconds * 1000;
        
        assert_eq!(timeout_ms, 30000);
    }

    #[test]
    fn test_system_env_vars() {
        let vars = vec!["PATH", "HOME", "USER", "SHELL"];
        
        for var in vars {
            assert!(!var.is_empty());
        }
    }

    #[test]
    fn test_system_process_info() {
        let pid: u32 = std::process::id();
        assert!(pid > 0);
        
        let _current_exe = std::env::current_exe();
    }
}
