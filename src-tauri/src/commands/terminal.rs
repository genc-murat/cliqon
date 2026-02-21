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
