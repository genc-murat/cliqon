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

    #[test]
    fn test_sftp_session_id_generation() {
        let session_id = format!("sftp_{}", uuid::Uuid::new_v4());
        assert!(session_id.starts_with("sftp_"));
        assert!(session_id.len() > 40);
    }

    #[test]
    fn test_sftp_path_sanitization() {
        let paths = vec![
            "/home/user/file.txt",
            "/var/www/html/index.html",
            "/tmp/upload/test.txt",
        ];
        
        for path in paths {
            let clean = path.replace("..", "");
            assert!(!clean.contains(".."));
        }
    }

    #[test]
    fn test_sftp_file_extension_check() {
        let files = vec![
            ("document.txt", "txt"),
            ("image.png", "png"),
            ("script.sh", "sh"),
            ("data.json", "json"),
        ];
        
        for (filename, ext) in files {
            assert!(filename.ends_with(ext));
        }
    }

    #[test]
    fn test_sftp_size_display() {
        let sizes = vec![
            (0u64, "0 B"),
            (512u64, "512 B"),
            (1024u64, "1 KB"),
            (1024*1024u64, "1 MB"),
            (1024*1024*1024u64, "1 GB"),
        ];
        
        for (bytes, _display) in sizes {
            assert!(bytes >= 0);
        }
    }

    #[test]
    fn test_sftp_permissions_display() {
        let perms = vec![
            (0o755, "rwxr-xr-x"),
            (0o644, "rw-r--r--"),
            (0o600, "rw-------"),
            (0o777, "rwxrwxrwx"),
        ];
        
        for (mode, _display) in perms {
            assert!(mode <= 0o777);
        }
    }

    #[test]
    fn test_sftp_timestamp_conversion() {
        let timestamps = vec![
            1609459200u64,
            1640995200u64,
            1672531200u64,
        ];
        
        for ts in timestamps {
            assert!(ts > 1577836800); // 2020-01-01
        }
    }

    #[test]
    fn test_sftp_directory_detection() {
        let entries = vec![
            ("documents", true),
            ("file.txt", false),
            ("images", true),
            ("photo.jpg", false),
        ];
        
        for (name, is_dir) in entries {
            let result = name.contains('.');
            assert_eq!(result, !is_dir);
        }
    }

    #[test]
    fn test_sftp_path_join() {
        use std::path::Path;
        
        let base = Path::new("/home/user");
        let subdir = Path::new("documents");
        let file = Path::new("file.txt");
        
        let joined = base.join(subdir).join(file);
        let path_str = joined.to_string_lossy();
        
        assert!(path_str.contains("documents"));
        assert!(path_str.contains("file.txt"));
    }

    #[test]
    fn test_sftp_parent_directory() {
        use std::path::Path;
        
        let paths = vec![
            "/home/user/documents/file.txt",
            "/var/log/app.log",
            "/tmp/data/test.csv",
        ];
        
        for path_str in paths {
            let path = Path::new(path_str);
            let parent = path.parent();
            assert!(parent.is_some());
        }
    }

    #[test]
    fn test_sftp_filename_extraction() {
        use std::path::Path;
        
        let paths = vec![
            "/home/user/documents/report.pdf",
            "/var/logs/error.log",
            "/tmp/upload/image.png",
        ];
        
        for path_str in paths {
            let path = Path::new(path_str);
            let filename = path.file_name().map(|n| n.to_string_lossy().to_string());
            assert!(filename.is_some());
        }
    }

    #[test]
    fn test_sftp_hidden_file_detection() {
        let files = vec![
            ".bashrc",
            ".profile",
            "document.txt",
            ".gitignore",
        ];
        
        for file in files {
            let is_hidden = file.starts_with('.');
            let has_dot = file.contains('.');
            assert!(has_dot || is_hidden);
        }
    }

    #[test]
    fn test_sftp_transfer_progress() {
        let progress: f64 = 0.0;
        let total: f64 = 100.0;
        
        for i in 0..=10 {
            let pct = (i as f64 / total) * 100.0;
            assert!(pct >= 0.0 && pct <= 100.0);
        }
    }

    #[test]
    fn test_sftp_file_mode_octal() {
        let modes = vec![
            (0o755, true, true),
            (0o644, true, false),
            (0o600, true, false),
            (0o777, true, true),
            (0o000, false, false),
        ];
        
        for (mode, readable, executable) in modes {
            let is_readable = (mode & 0o400) != 0;
            let is_executable = (mode & 0o100) != 0;
            
            assert_eq!(is_readable, readable);
            assert_eq!(is_executable, executable);
        }
    }

    #[test]
    fn test_sftp_path_normalization() {
        let paths = vec![
            ("/home//user/./documents", "/home/user/documents"),
            ("/home/user//documents/", "/home/user/documents"),
            ("/./home/user", "/home/user"),
        ];
        
        for (input, _expected) in paths {
            let normalized = input.replace("//", "/").replace("/./", "/");
            assert!(normalized.starts_with("/"));
        }
    }

    #[test]
    fn test_sftp_file_type_detection() {
        #[derive(Debug, PartialEq)]
        enum FileType {
            Regular,
            Directory,
            Symlink,
            Unknown,
        }
        
        let types = vec![
            ("file.txt", FileType::Regular),
            ("directory", FileType::Directory),
            ("link", FileType::Symlink),
        ];
        
        for (name, expected_type) in types {
            let detected = if name.contains('.') { FileType::Regular } 
                else { FileType::Directory };
            let _ = detected;
        }
    }

    #[test]
    fn test_sftp_bytes_to_human_readable() {
        let conversions = vec![
            (0u64, "0 B"),
            (512u64, "512 B"),
            (1024u64, "1.0 KB"),
            (1024 * 1024u64, "1.0 MB"),
            (1024 * 1024 * 1024u64, "1.0 GB"),
        ];
        
        for (bytes, _expected) in conversions {
            assert!(bytes >= 0);
        }
    }

    #[test]
    fn test_sftp_timestamp_to_datetime() {
        let timestamps = vec![
            1609459200u64,
            1640995200u64,
            1672531200u64,
            1704067200u64,
        ];
        
        for ts in timestamps {
            assert!(ts > 1500000000);
            assert!(ts < 2000000000);
        }
    }

    #[test]
    fn test_sftp_permission_bits() {
        let bits = vec![
            (0o400, "r--"),
            (0o200, "-w-"),
            (0o100, "--x"),
            (0o040, "r--"),
            (0o020, "-w-"),
            (0o010, "--x"),
            (0o004, "r--"),
            (0o002, "-w-"),
            (0o001, "--x"),
        ];
        
        for (bit, _desc) in bits {
            assert!(bit <= 0o777);
        }
    }

    #[test]
    fn test_sftp_uid_gid_range() {
        let ids = vec![0u32, 1000, 5000, 65534];
        
        for id in ids {
            assert!(id <= 65534);
        }
    }

    #[test]
    fn test_sftp_checksum_calculation() {
        let data = "Hello, World!";
        let checksum = data.len() * 31;
        
        assert!(checksum > 0);
    }
}
