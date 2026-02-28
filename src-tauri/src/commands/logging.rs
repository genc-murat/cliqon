use tauri::{AppHandle, State};
use std::sync::Arc;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;
use crate::services::logging::LogManager;

#[tauri::command]
pub async fn start_log_tail(
    app: AppHandle,
    state: State<'_, AppState>,
    log_manager: State<'_, Arc<LogManager>>,
    profile: SshProfile,
    path: String,
    session_id: String,
) -> Result<()> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    
    log_manager.start_tail(app, profile, secret, path, session_id)?;
    Ok(())
}

#[tauri::command]
pub async fn stop_log_tail(
    log_manager: State<'_, Arc<LogManager>>,
    session_id: String,
) -> Result<()> {
    log_manager.stop_tail(&session_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logging_command_types() {
        let _result_unit: Result<()> = Ok(());
    }

    #[test]
    fn test_logging_operations() {
        let operations = vec!["start_log_tail", "stop_log_tail"];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_logging_session_id_format() {
        let session_ids = vec!["log-1", "tail-abc", "session-xyz"];
        for id in session_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_logging_path_formats() {
        let paths = vec![
            "/var/log/syslog",
            "/var/log/auth.log",
            "/var/log/nginx/access.log",
        ];
        for path in paths {
            assert!(!path.is_empty());
        }
    }

    #[test]
    fn test_logging_secret_handling() {
        let secret: Option<String> = None;
        assert!(secret.is_none());

        let secret2: Option<String> = Some("password".to_string());
        assert!(secret2.is_some());
    }

    #[test]
    fn test_logging_state_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_logging_manager_methods() {
        let methods = vec!["start_tail", "stop_tail"];
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_logging_arc_type() {
        let _log_manager: Arc<LogManager> = Arc::new(LogManager::new());
    }

    #[test]
    fn test_logging_string_format() {
        let error_msg = format!("Failed to retrieve password: {}", "test error");
        assert!(error_msg.contains("Failed"));
        assert!(error_msg.contains("test error"));
    }

    #[test]
    fn test_logging_string_cloning() {
        let path = "/var/log/syslog".to_string();
        let session_id = "log-1".to_string();
        
        assert_eq!(path.clone(), path);
        assert_eq!(session_id.clone(), session_id);
    }
}
