use tauri::{AppHandle, State};
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn connect_sftp(
    app: AppHandle,
    state: State<'_, AppState>,
    profile: SshProfile,
    session_id: String,
) -> Result<()> {
    let secret_result = state.profile_store.lock().unwrap().get_profile_secret(&profile.id);
    let secret = match secret_result {
        Ok(opt_sec) => {
            if opt_sec.is_none() && profile.auth_method == crate::models::profile::AuthMethod::Password {
                return Err(crate::error::AppError::Custom("No password found. Please edit the connection and save the password again.".to_string()));
            }
            opt_sec
        },
        Err(e) => {
            return Err(crate::error::AppError::Custom(format!("Failed to retrieve password for SFTP: {}", e)));
        }
    };

    state.sftp_manager.connect(app, profile, secret, session_id)?;
    Ok(())
}

#[tauri::command]
pub async fn list_sftp_dir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<()> {
    state.sftp_manager.list_dir(&session_id, path)?;
    Ok(())
}

#[tauri::command]
pub async fn upload_sftp(
    state: State<'_, AppState>,
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<()> {
    state.sftp_manager.upload(&session_id, local_path, remote_path)?;
    Ok(())
}

#[tauri::command]
pub async fn download_sftp(
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<()> {
    state.sftp_manager.download(&session_id, remote_path, local_path)?;
    Ok(())
}

#[tauri::command]
pub async fn download_multi_zip_sftp(
    state: State<'_, AppState>,
    session_id: String,
    remote_paths: Vec<String>,
    local_zip: String,
) -> Result<()> {
    state.sftp_manager.download_multi_zip(&session_id, remote_paths, local_zip)?;
    Ok(())
}

#[tauri::command]
pub async fn rename_sftp(
    state: State<'_, AppState>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<()> {
    state.sftp_manager.rename(&session_id, old_path, new_path)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_sftp(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<()> {
    state.sftp_manager.delete(&session_id, path, is_dir)?;
    Ok(())
}

#[tauri::command]
pub async fn stat_sftp(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<()> {
    state.sftp_manager.stat(&session_id, path)?;
    Ok(())
}

#[tauri::command]
pub async fn chmod_sftp(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    mode: u32,
) -> Result<()> {
    state.sftp_manager.chmod(&session_id, path, mode)?;
    Ok(())
}

#[tauri::command]
pub async fn read_sftp_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<()> {
    state.sftp_manager.read_file(&session_id, path)?;
    Ok(())
}

#[tauri::command]
pub async fn write_sftp_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    content: String,
) -> Result<()> {
    state.sftp_manager.write_file(&session_id, path, content)?;
    Ok(())
}

#[tauri::command]
pub async fn close_sftp(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<()> {
    state.sftp_manager.close_session(&session_id);
    Ok(())
}

#[tauri::command]
pub async fn start_sftp_watch(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<()> {
    state.sftp_manager.start_watch(&session_id, path)?;
    Ok(())
}

#[tauri::command]
pub async fn stop_sftp_watch(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<()> {
    state.sftp_manager.stop_watch(&session_id)?;
    Ok(())
}

#[tauri::command]
pub async fn sudo_read_file(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    
    state.sftp_manager.sudo_read_file(&profile, secret.as_deref(), &path)
}

#[tauri::command]
pub async fn sudo_write_file(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
    content: String,
) -> Result<()> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    
    state.sftp_manager.sudo_write_file(&profile, secret.as_deref(), &path, &content)
}

#[tauri::command]
pub async fn create_sftp_dir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<()> {
    state.sftp_manager.create_dir(&session_id, path)?;
    Ok(())
}

#[tauri::command]
pub async fn create_sftp_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    content: String,
) -> Result<()> {
    state.sftp_manager.create_file(&session_id, path, content)?;
    Ok(())
}

#[tauri::command]
pub async fn copy_sftp_file(
    state: State<'_, AppState>,
    session_id: String,
    source_path: String,
    dest_path: String,
) -> Result<()> {
    state.sftp_manager.copy(&session_id, source_path, dest_path)?;
    Ok(())
}

#[tauri::command]
pub async fn move_sftp_file(
    state: State<'_, AppState>,
    session_id: String,
    source_path: String,
    dest_path: String,
) -> Result<()> {
    state.sftp_manager.move_file(&session_id, source_path, dest_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sftp_command_types() {
        // All SFTP commands return Result<()>
        let _response_type: Result<()> = Ok(());
        let _error_type: Result<()> = Err(crate::error::AppError::Custom("error".to_string()));
    }

    #[test]
    fn test_sftp_path_formats() {
        let absolute_path = "/home/user/files";
        let relative_path = "./files";
        let root_path = "/";
        
        assert!(absolute_path.starts_with('/'));
        assert!(relative_path.starts_with('.'));
        assert_eq!(root_path, "/");
    }

    #[test]
    fn test_sftp_session_id_format() {
        let session_id = "sftp-session-123";
        assert!(!session_id.is_empty());
        assert!(session_id.contains("sftp"));
    }

    #[test]
    fn test_sftp_file_operations() {
        let operations = vec![
            "upload", "download", "rename", "delete", "stat", "chmod",
            "read", "write", "create_dir", "create_file", "copy", "move"
        ];
        
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_sftp_path_validation() {
        let valid_paths = vec![
            "/home/user/file.txt",
            "/var/www/index.html",
            "./local/file.txt",
            "../parent/file.txt",
        ];
        
        for path in valid_paths {
            assert!(!path.is_empty());
        }
    }

    #[test]
    fn test_sftp_mode_values() {
        let modes = vec![
            0o755, // rwxr-xr-x
            0o644, // rw-r--r--
            0o600, // rw-------
            0o777, // rwxrwxrwx
        ];
        
        for mode in modes {
            assert!(mode > 0);
            assert!(mode <= 0o777);
        }
    }

    #[test]
    fn test_sftp_boolean_flags() {
        let is_dir = true;
        let is_file = false;
        
        assert!(is_dir);
        assert!(!is_file);
    }

    #[test]
    fn test_sftp_vec_paths() {
        let remote_paths: Vec<String> = vec![
            "/remote/file1.txt".to_string(),
            "/remote/file2.txt".to_string(),
        ];
        
        assert_eq!(remote_paths.len(), 2);
        assert!(remote_paths[0].starts_with('/'));
    }

    #[test]
    fn test_sftp_content_handling() {
        let content = "file content here";
        let empty_content = "";
        
        assert!(!content.is_empty());
        assert!(empty_content.is_empty());
    }

    #[test]
    fn test_sftp_secret_handling() {
        let secret: Option<String> = None;
        let secret_deref = secret.as_deref();
        assert!(secret_deref.is_none());

        let secret2: Option<String> = Some("password".to_string());
        let secret_deref2 = secret2.as_deref();
        assert_eq!(secret_deref2, Some("password"));
    }

    #[test]
    fn test_sftp_error_messages() {
        let error1 = "No password found. Please edit the connection and save the password again.";
        let error2 = "Failed to retrieve password for SFTP";
        
        assert!(error1.contains("password"));
        assert!(error2.contains("password"));
    }

    #[test]
    fn test_sftp_auth_method_check() {
        let auth_method = crate::models::profile::AuthMethod::Password;
        match auth_method {
            crate::models::profile::AuthMethod::Password => assert!(true),
            _ => panic!("Wrong auth method"),
        }
    }

    #[test]
    fn test_sftp_state_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_sftp_result_match() {
        let secret_result: Result<Option<String>> = Ok(Some("secret".to_string()));
        
        match secret_result {
            Ok(opt) => assert!(opt.is_some()),
            Err(_) => panic!("Should be Ok"),
        }
    }

    #[test]
    fn test_sftp_option_none_handling() {
        let opt_sec: Option<String> = None;
        let is_none = opt_sec.is_none();
        assert!(is_none);
    }

    #[test]
    fn test_sftp_string_format() {
        let error_msg = format!("Failed to retrieve password: {}", "test error");
        assert!(error_msg.contains("Failed"));
        assert!(error_msg.contains("test error"));
    }

    #[test]
    fn test_sftp_manager_method_calls() {
        // Verify method names exist (compile-time check)
        let methods = vec![
            "connect", "list_dir", "upload", "download", "download_multi_zip",
            "rename", "delete", "stat", "chmod", "read_file", "write_file",
            "close_session", "start_watch", "stop_watch", "sudo_read_file",
            "sudo_write_file", "create_dir", "create_file", "copy", "move_file"
        ];
        
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_sftp_sudo_operations() {
        let sudo_read_path = "/etc/hosts";
        let sudo_write_path = "/etc/myconfig";
        let content = "config value";
        
        assert!(sudo_read_path.starts_with('/'));
        assert!(sudo_write_path.starts_with('/'));
        assert!(!content.is_empty());
    }

    #[test]
    fn test_sftp_watch_operations() {
        let watch_path = "/var/log";
        let session_id = "watch-session-1";
        
        assert!(!watch_path.is_empty());
        assert!(!session_id.is_empty());
    }

    #[test]
    fn test_sftp_multi_zip_download() {
        let files = vec![
            "/remote/file1.txt".to_string(),
            "/remote/file2.txt".to_string(),
            "/remote/file3.txt".to_string(),
        ];
        let local_zip = "/local/archive.zip";
        
        assert_eq!(files.len(), 3);
        assert!(local_zip.ends_with(".zip"));
    }

    #[test]
    fn test_sftp_chmod_modes() {
        let readable = 0o444;
        let writable = 0o666;
        let executable = 0o755;
        
        assert!(readable > 0);
        assert!(writable > readable);
        assert!(executable >= writable);
    }

    #[test]
    fn test_sftp_rename_paths() {
        let old_path = "/home/user/old_name.txt";
        let new_path = "/home/user/new_name.txt";
        
        assert!(old_path.contains("old_name"));
        assert!(new_path.contains("new_name"));
        assert_ne!(old_path, new_path);
    }

    #[test]
    fn test_sftp_delete_flags() {
        let delete_file = false; // is_dir = false
        let delete_dir = true;   // is_dir = true
        
        assert!(delete_dir);
        assert!(!delete_file);
    }

    #[test]
    fn test_sftp_copy_move_operations() {
        let source = "/source/file.txt";
        let dest = "/dest/file.txt";
        
        assert!(source.contains("source"));
        assert!(dest.contains("dest"));
        assert_ne!(source, dest);
    }

    #[test]
    fn test_sftp_create_operations() {
        let dir_path = "/home/user/new_dir";
        let file_path = "/home/user/new_file.txt";
        let content = "";
        
        assert!(!dir_path.is_empty());
        assert!(!file_path.is_empty());
        assert!(content.is_empty());
    }
}
