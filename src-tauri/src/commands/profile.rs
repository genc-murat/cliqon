use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;
use crate::services::import::ImportService;

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

#[tauri::command]
pub async fn import_profiles(
    state: State<'_, AppState>,
    source: String,
    content: String,
) -> Result<usize> {
    let profiles = match source.as_str() {
        "mobaxterm" => ImportService::parse_mxtsessions(&content)?,
        "termius" => ImportService::parse_termius_json(&content)?,
        _ => return Err(crate::error::AppError::Custom("Invalid import source".to_string())),
    };

    let count = profiles.len();
    let store = state.profile_store.lock().unwrap();
    
    let mut current_profiles = store.get_all_profiles()?;
    for p in profiles {
        current_profiles.push(p);
    }
    store.save_profiles(&current_profiles)?;

    Ok(count)
}
