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
