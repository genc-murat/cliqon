use std::sync::Arc;
use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;
use crate::services::system::SystemService;

#[tauri::command]
pub async fn get_system_services(
    state: State<'_, AppState>,
    profile: SshProfile,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.get_system_services(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn manage_service(
    state: State<'_, AppState>,
    profile: SshProfile,
    action: String,
    service: String,
    system_service: State<'_, Arc<SystemService>>,
) -> Result<String> {
    let secret = state.profile_store.lock().unwrap().get_profile_secret(&profile.id)
        .map_err(|e| crate::error::AppError::Custom(format!("Failed to retrieve password: {}", e)))?;
    system_service.manage_service(&profile, secret.as_deref(), &action, &service)
}
