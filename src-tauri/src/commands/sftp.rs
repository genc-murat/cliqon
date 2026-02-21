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
pub async fn close_sftp(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<()> {
    state.sftp_manager.close_session(&session_id);
    Ok(())
}
