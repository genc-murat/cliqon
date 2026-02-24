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
