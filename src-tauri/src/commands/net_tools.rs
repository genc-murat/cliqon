use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn run_net_tool(
    state: State<'_, AppState>,
    profile: SshProfile,
    tool_type: String,
    target: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .net_tool_manager
        .run_tool(&profile, secret.as_deref(), &tool_type, &target)
}
