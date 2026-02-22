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
pub async fn share_items_with_peer(
    state: State<'_, AppState>,
    peer_id: String,
    profile_ids: Vec<String>,
    snippet_ids: Vec<String>,
) -> Result<String> {
    let service = state.sharing_service.lock().unwrap();

    // Find the peer
    let peers = service.get_peers();
    let peer = peers.iter().find(|p| p.id == peer_id)
        .ok_or_else(|| crate::error::AppError::Custom("Peer not found".to_string()))?;

    // Get the profiles
    let mut shareable_profiles: Vec<ShareableProfile> = Vec::new();
    if !profile_ids.is_empty() {
        let store = state.profile_store.lock().unwrap();
        let all_profiles = store.get_all_profiles()?;
        for pid in &profile_ids {
            if let Some(profile) = all_profiles.iter().find(|p| p.id == *pid) {
                let secret = store.get_profile_secret(pid).ok().flatten();
                shareable_profiles.push(ShareableProfile::from_profile(profile, secret));
            }
        }
    }

    // Get the snippets
    let mut shareable_snippets: Vec<ShareableSnippet> = Vec::new();
    if !snippet_ids.is_empty() {
        let store = state.snippet_store.lock().unwrap();
        let all_snippets = store.get_all()?;
        for sid in &snippet_ids {
            if let Some(snippet) = all_snippets.iter().find(|s| s.id == *sid) {
                shareable_snippets.push(ShareableSnippet::from(snippet.clone()));
            }
        }
    }

    if shareable_profiles.is_empty() && shareable_snippets.is_empty() {
        return Err(crate::error::AppError::Custom("No items to share".to_string()));
    }

    let peer_clone = peer.clone();
    service.share_with_peer(&peer_clone, shareable_profiles, shareable_snippets)
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

    let mut count = 0;

    // Save profiles
    if !share.profiles.is_empty() {
        let store = state.profile_store.lock().unwrap();
        for sp in &share.profiles {
            let ssh_profile = sp.to_ssh_profile();
            let secret = sp.secret.clone();
            store.save_profile(ssh_profile, secret)?;
            count += 1;
        }
    }

    // Save snippets
    if !share.snippets.is_empty() {
        let store = state.snippet_store.lock().unwrap();
        for ss in &share.snippets {
            let snippet = crate::models::snippet::Snippet::from(ss.clone());
            store.save(snippet)?;
            count += 1;
        }
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
#[tauri::command]
pub async fn ping_peer(state: State<'_, AppState>, ip: String, port: u16) -> Result<PeerInfo> {
    let service = state.sharing_service.lock().unwrap();
    let peer = service.ping_peer(&ip, port).map_err(|e| crate::error::AppError::Custom(e))?;
    service.add_manual_peer(peer.clone());
    Ok(peer)
}
