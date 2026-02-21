use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn get_profiles(state: State<'_, AppState>) -> Result<Vec<SshProfile>> {
    let store = state.profile_store.lock().unwrap();
    store.get_all_profiles()
}

#[tauri::command]
pub async fn save_profile(
    state: State<'_, AppState>,
    profile: SshProfile,
    secret: Option<String>,
) -> Result<()> {
    let store = state.profile_store.lock().unwrap();
    store.save_profile(profile, secret)
}

#[tauri::command]
pub async fn delete_profile(state: State<'_, AppState>, id: String) -> Result<()> {
    let store = state.profile_store.lock().unwrap();
    store.delete_profile(&id)
}

#[tauri::command]
pub async fn get_profile_secret(state: State<'_, AppState>, id: String) -> Result<Option<String>> {
    let store = state.profile_store.lock().unwrap();
    store.get_profile_secret(&id)
}
