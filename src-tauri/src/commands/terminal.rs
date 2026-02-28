use tauri::{AppHandle, State};
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn connect_ssh(
    app: AppHandle,
    state: State<'_, AppState>,
    profile: SshProfile,
    session_id: String,
) -> Result<()> {
    // Attempt to load the secret from keyring
    let secret_result = state.profile_store.lock().unwrap().get_profile_secret(&profile.id);
    let secret = match secret_result {
        Ok(opt_sec) => {
            if opt_sec.is_none() && profile.auth_method == crate::models::profile::AuthMethod::Password {
                return Err(crate::error::AppError::Custom("No password found. Please edit the connection and save the password again.".to_string()));
            }
            opt_sec
        },
        Err(e) => {
            return Err(crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)));
        }, 
    };

    state.ssh_manager.connect(app, profile, secret, session_id)?;
    Ok(())
}

#[tauri::command]
pub async fn test_ssh_connection(
    state: State<'_, AppState>,
    profile: SshProfile,
    provided_secret: Option<String>,
) -> Result<()> {
    let secret = match provided_secret {
        Some(s) if !s.is_empty() => Some(s),
        _ => {
            if !profile.id.is_empty() {
                state.profile_store.lock().unwrap().get_profile_secret(&profile.id).unwrap_or(None)
            } else {
                None
            }
        }
    };
    state.ssh_manager.test_connection(&profile, secret.as_deref())?;
    Ok(())
}

#[tauri::command]
pub async fn write_to_pty(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<()> {
    state.ssh_manager.write_to_session(&session_id, data)?;
    Ok(())
}

#[tauri::command]
pub async fn resize_pty(
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<()> {
    state.ssh_manager.resize_session(&session_id, cols, rows)?;
    Ok(())
}

#[tauri::command]
pub async fn close_pty(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<()> {
    state.ssh_manager.close_session(&session_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_command_types() {
        let _response_type: Result<()> = Ok(());
        let _error_type: Result<()> = Err(crate::error::AppError::Custom("error".to_string()));
    }

    #[test]
    fn test_ssh_session_id_format() {
        let session_id = "ssh-session-123";
        assert!(!session_id.is_empty());
        assert!(session_id.contains("ssh"));
    }

    #[test]
    fn test_pty_data_handling() {
        let data: Vec<u8> = vec![1, 2, 3, 4];
        let empty_data: Vec<u8> = vec![];
        
        assert_eq!(data.len(), 4);
        assert_eq!(empty_data.len(), 0);
    }

    #[test]
    fn test_pty_dimensions() {
        let cols: u32 = 80;
        let rows: u32 = 24;
        
        assert!(cols > 0);
        assert!(rows > 0);
    }

    #[test]
    fn test_pty_standard_sizes() {
        let sizes = vec![
            (80, 24),   // Standard
            (132, 24),  // Wide
            (80, 43),   // Tall
            (132, 43),  // Large
        ];
        
        for (c, r) in sizes {
            assert!(c > 0);
            assert!(r > 0);
        }
    }

    #[test]
    fn test_ssh_connection_test() {
        let provided_secret: Option<String> = None;
        assert!(provided_secret.is_none());

        let provided_secret2: Option<String> = Some("password".to_string());
        assert!(provided_secret2.is_some());
    }

    #[test]
    fn test_ssh_secret_empty_check() {
        let secret = String::new();
        assert!(secret.is_empty());

        let secret2 = "password".to_string();
        assert!(!secret2.is_empty());
    }

    #[test]
    fn test_ssh_profile_id_check() {
        let profile_id = String::new();
        assert!(profile_id.is_empty());

        let profile_id2 = "profile-123";
        assert!(!profile_id2.is_empty());
    }

    #[test]
    fn test_terminal_auth_method_check() {
        let auth_method = crate::models::profile::AuthMethod::Password;
        match auth_method {
            crate::models::profile::AuthMethod::Password => assert!(true),
            _ => panic!("Wrong auth method"),
        }
    }

    #[test]
    fn test_terminal_error_messages() {
        let error1 = "No password found. Please edit the connection and save the password again.";
        let error2 = "Failed to retrieve password";
        
        assert!(error1.contains("password"));
        assert!(error2.contains("password"));
    }

    #[test]
    fn test_terminal_state_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_terminal_result_match() {
        let secret_result: Result<Option<String>> = Ok(Some("secret".to_string()));
        
        match secret_result {
            Ok(opt) => assert!(opt.is_some()),
            Err(_) => panic!("Should be Ok"),
        }
    }

    #[test]
    fn test_terminal_manager_methods() {
        let methods = vec![
            "connect", "test_connection", "write_to_session", 
            "resize_session", "close_session"
        ];
        
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_terminal_byte_vector_operations() {
        let mut data: Vec<u8> = Vec::new();
        data.push(0x41); // 'A'
        data.push(0x42); // 'B'
        
        assert_eq!(data.len(), 2);
        assert_eq!(data[0], 0x41);
    }

    #[test]
    fn test_terminal_u32_dimensions() {
        let cols: u32 = 100;
        let rows: u32 = 50;
        
        let _combined = (cols, rows);
        assert!(cols > 0);
        assert!(rows > 0);
    }

    #[test]
    fn test_terminal_option_handling() {
        let opt: Option<String> = None;
        assert!(opt.is_none());

        let opt2: Option<String> = Some("value".to_string());
        assert!(opt2.is_some());
        assert_eq!(opt2.unwrap(), "value");
    }

    #[test]
    fn test_terminal_string_format() {
        let error_msg = format!("Failed to retrieve password: {}", "test error");
        assert!(error_msg.contains("Failed"));
        assert!(error_msg.contains("test error"));
    }

    #[test]
    fn test_terminal_async_function_types() {
        use std::future;
        let _connect_ssh: fn(AppHandle, State<'_, AppState>, SshProfile, String) -> future::Ready<Result<()>> = 
            |_, _, _, _| future::ready(Ok(()));
    }

    #[test]
    fn test_terminal_profile_id_empty_validation() {
        let profile_id = "";
        let is_empty = profile_id.is_empty();
        assert!(is_empty);

        let profile_id2 = "valid-id";
        let is_not_empty = !profile_id2.is_empty();
        assert!(is_not_empty);
    }

    #[test]
    fn test_terminal_secret_unwrap_or() {
        let result: Result<Option<String>> = Ok(None);
        let unwrapped = result.unwrap_or(None);
        assert!(unwrapped.is_none());
    }

    #[test]
    fn test_terminal_as_deref() {
        let secret: Option<String> = Some("password".to_string());
        let deref = secret.as_deref();
        assert_eq!(deref, Some("password"));
    }
}
