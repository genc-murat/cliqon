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
