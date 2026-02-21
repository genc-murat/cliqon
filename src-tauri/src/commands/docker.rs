use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn get_docker_containers(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_containers(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn start_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .start_container(&profile, secret.as_deref(), &container_id)
}

#[tauri::command]
pub async fn stop_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .stop_container(&profile, secret.as_deref(), &container_id)
}

#[tauri::command]
pub async fn restart_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .restart_container(&profile, secret.as_deref(), &container_id)
}
