use tauri::State;
use crate::error::{AppError, Result};
use crate::models::profile::TunnelConfig;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn start_tunnel(
    session_id: String,
    config: TunnelConfig,
    state: State<'_, AppState>,
) -> Result<()> {
    // 1. Get the session
    let session = state
        .ssh_manager
        .get_session(&session_id)
        .ok_or_else(|| AppError::Custom("SSH Session not found".to_string()))?;
        
    // 2. Start the tunnel
    state.tunnel_service.start_tunnel(&session, config, session_id)?;

    Ok(())
}

#[tauri::command]
pub async fn stop_tunnel(
    tunnel_id: String,
    state: State<'_, AppState>,
) -> Result<()> {
    state.tunnel_service.stop_tunnel(&tunnel_id)?;
    Ok(())
}

#[tauri::command]
pub async fn get_active_tunnels(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<TunnelConfig>> {
    Ok(state.tunnel_service.get_active_tunnels(&session_id))
}
