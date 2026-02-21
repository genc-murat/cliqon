use tauri::State;
use crate::error::Result;
use crate::models::sharing::*;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn start_sharing(state: State<'_, AppState>) -> Result<SharingStatus> {
    let service = state.sharing_service.lock().unwrap();
    service.start().map_err(|e| crate::error::AppError::Custom(e))?;
    Ok(service.get_status())
}

#[tauri::command]
pub async fn stop_sharing(state: State<'_, AppState>) -> Result<SharingStatus> {
    let service = state.sharing_service.lock().unwrap();
    service.stop();
    Ok(service.get_status())
}

#[tauri::command]
pub async fn get_sharing_status(state: State<'_, AppState>) -> Result<SharingStatus> {
    let service = state.sharing_service.lock().unwrap();
    Ok(service.get_status())
}

#[tauri::command]
pub async fn set_sharing_display_name(state: State<'_, AppState>, name: String) -> Result<()> {
    let service = state.sharing_service.lock().unwrap();
    service.set_display_name(name);
    Ok(())
}

#[tauri::command]
pub async fn get_discovered_peers(state: State<'_, AppState>) -> Result<Vec<PeerInfo>> {
    let service = state.sharing_service.lock().unwrap();
    Ok(service.get_peers())
}

#[tauri::command]
pub async fn share_profiles_with_peer(
    state: State<'_, AppState>,
    peer_id: String,
    profile_ids: Vec<String>,
) -> Result<String> {
    let service = state.sharing_service.lock().unwrap();

    // Find the peer
    let peers = service.get_peers();
    let peer = peers.iter().find(|p| p.id == peer_id)
        .ok_or_else(|| crate::error::AppError::Custom("Peer not found".to_string()))?;

    // Get the profiles with their secrets
    let store = state.profile_store.lock().unwrap();
    let all_profiles = store.get_all_profiles()?;
    let mut shareable: Vec<ShareableProfile> = Vec::new();

    for pid in &profile_ids {
        if let Some(profile) = all_profiles.iter().find(|p| p.id == *pid) {
            let secret = store.get_profile_secret(pid).ok().flatten();
            shareable.push(ShareableProfile::from_profile(profile, secret));
        }
    }

    if shareable.is_empty() {
        return Err(crate::error::AppError::Custom("No profiles to share".to_string()));
    }

    let peer_clone = peer.clone();
    drop(store); // release lock
    service.share_profiles_with_peer(&peer_clone, shareable)
        .map_err(|e| crate::error::AppError::Custom(e))
}

#[tauri::command]
pub async fn get_pending_shares(state: State<'_, AppState>) -> Result<Vec<PendingShare>> {
    let service = state.sharing_service.lock().unwrap();
    Ok(service.get_pending_shares())
}

#[tauri::command]
pub async fn accept_share(
    state: State<'_, AppState>,
    share_id: String,
) -> Result<usize> {
    let service = state.sharing_service.lock().unwrap();
    let share = service.accept_share(&share_id)
        .ok_or_else(|| crate::error::AppError::Custom("Share not found".to_string()))?;

    let store = state.profile_store.lock().unwrap();
    let count = share.profiles.len();

    for sp in share.profiles {
        let ssh_profile = sp.to_ssh_profile();
        let secret = sp.secret.clone();
        store.save_profile(ssh_profile, secret)?;
    }

    Ok(count)
}

#[tauri::command]
pub async fn reject_share(
    state: State<'_, AppState>,
    share_id: String,
) -> Result<()> {
    let service = state.sharing_service.lock().unwrap();
    service.reject_share(&share_id);
    Ok(())
}
