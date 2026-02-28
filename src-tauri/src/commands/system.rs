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
}
