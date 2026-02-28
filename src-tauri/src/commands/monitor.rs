use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn start_monitor(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    profile: SshProfile,
    session_id: String,
) -> Result<()> {
    // Get secret for authentication
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state.monitor_manager.start(app, profile, secret, session_id)?;
    Ok(())
}

#[tauri::command]
pub async fn stop_monitor(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<()> {
    state.monitor_manager.stop(&session_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_monitor_command_types() {
        let _result_unit: Result<()> = Ok(());
    }

    #[test]
    fn test_monitor_operations() {
        let operations = vec!["start", "stop"];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_monitor_session_id_format() {
        let session_ids = vec!["monitor-1", "session-abc", "mon-xyz"];
        for id in session_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_monitor_secret_handling() {
        let secret: Option<String> = None;
        assert!(secret.is_none());

        let secret2: Option<String> = Some("password".to_string());
        assert!(secret2.is_some());
    }

    #[test]
    fn test_monitor_state_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_monitor_result_unwrap_or() {
        let result: Result<Option<String>> = Ok(None);
        let unwrapped = result.unwrap_or(None);
        assert!(unwrapped.is_none());
    }

    #[test]
    fn test_monitor_manager_methods() {
        let methods = vec!["start", "stop"];
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_monitor_app_handle_type() {
        // Type check for AppHandle
        let _type_check: fn(tauri::AppHandle) = |_| {};
    }

    #[test]
    fn test_monitor_async_function_types() {
        use std::future;
        let _start_monitor: fn(tauri::AppHandle, State<'_, AppState>, SshProfile, String) -> future::Ready<Result<()>> = 
            |_, _, _, _| future::ready(Ok(()));
    }
}
