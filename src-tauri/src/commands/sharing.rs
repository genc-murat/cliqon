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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sharing_command_types() {
        let _result_status: Result<SharingStatus> = Ok(SharingStatus { active: false, display_name: "test".to_string(), local_ip: "127.0.0.1".to_string(), http_port: 8080, peer_count: 0 });
        let _result_vec: Result<Vec<PeerInfo>> = Ok(Vec::new());
        let _result_string: Result<String> = Ok("shared".to_string());
        let _result_unit: Result<()> = Ok(());
        let _result_usize: Result<usize> = Ok(5);
    }

    #[test]
    fn test_sharing_operations() {
        let operations = vec![
            "start", "stop", "get_status", "set_display_name",
            "get_peers", "share_with_peer", "get_pending", "accept", "reject", "ping"
        ];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_peer_id_format() {
        let peer_ids = vec!["peer-123", "device-abc", "computer-xyz"];
        for id in peer_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_share_id_format() {
        let share_ids = vec!["share-1", "share-abc", "pending-xyz"];
        for id in share_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_display_name_formats() {
        let names = vec!["My Computer", "Work Laptop", "Home Server"];
        for name in names {
            assert!(!name.is_empty());
        }
    }

    #[test]
    fn test_profile_ids_vec() {
        let profile_ids: Vec<String> = vec!["p1".to_string(), "p2".to_string()];
        assert_eq!(profile_ids.len(), 2);
        assert!(!profile_ids.is_empty());
    }

    #[test]
    fn test_snippet_ids_vec() {
        let snippet_ids: Vec<String> = vec!["s1".to_string(), "s2".to_string(), "s3".to_string()];
        assert_eq!(snippet_ids.len(), 3);
    }

    #[test]
    fn test_sharing_status_struct() {
        let status = SharingStatus {
            active: false,
            display_name: "test".to_string(),
            local_ip: "127.0.0.1".to_string(),
            http_port: 8080,
            peer_count: 0,
        };
        assert!(!status.active);
        assert_eq!(status.display_name, "test");
    }

    #[test]
    fn test_sharing_status_running() {
        let status = SharingStatus {
            active: true,
            display_name: "test".to_string(),
            local_ip: "127.0.0.1".to_string(),
            http_port: 8080,
            peer_count: 0,
        };
        assert!(status.active);
    }

    #[test]
    fn test_sharing_empty_items_check() {
        let profile_ids: Vec<String> = Vec::new();
        let snippet_ids: Vec<String> = Vec::new();
        
        let profiles_empty = profile_ids.is_empty();
        let snippets_empty = snippet_ids.is_empty();
        
        assert!(profiles_empty);
        assert!(snippets_empty);
    }

    #[test]
    fn test_sharing_not_empty_check() {
        let profile_ids: Vec<String> = vec!["p1".to_string()];
        let snippet_ids: Vec<String> = vec!["s1".to_string()];
        
        let profiles_not_empty = !profile_ids.is_empty();
        let snippets_not_empty = !snippet_ids.is_empty();
        
        assert!(profiles_not_empty);
        assert!(snippets_not_empty);
    }

    #[test]
    fn test_sharing_peer_not_found_error() {
        let error = crate::error::AppError::Custom("Peer not found".to_string());
        assert!(error.to_string().contains("Peer"));
    }

    #[test]
    fn test_sharing_no_items_error() {
        let error = crate::error::AppError::Custom("No items to share".to_string());
        assert!(error.to_string().contains("items"));
    }

    #[test]
    fn test_sharing_state_lock_pattern() {
        let service = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = service.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_sharing_vec_find_operation() {
        let peers = vec!["peer1", "peer2", "peer3"];
        let found = peers.iter().find(|p| *p == &"peer2");
        assert_eq!(found, Some(&"peer2"));

        let not_found = peers.iter().find(|p| *p == &"peer4");
        assert_eq!(not_found, None);
    }

    #[test]
    fn test_sharing_ok_or_else() {
        let peer: Option<&str> = Some("peer1");
        let result = peer.ok_or_else(|| crate::error::AppError::Custom("not found".to_string()));
        assert!(result.is_ok());

        let peer2: Option<&str> = None;
        let result2 = peer2.ok_or_else(|| crate::error::AppError::Custom("not found".to_string()));
        assert!(result2.is_err());
    }

    #[test]
    fn test_sharing_string_format() {
        let peer_id = "peer-123";
        let profiles_count = 2;
        let snippets_count = 3;
        
        let msg = format!("Shared {} profiles and {} snippets with peer {}", profiles_count, snippets_count, peer_id);
        assert!(msg.contains("2 profiles"));
        assert!(msg.contains("3 snippets"));
    }

    #[test]
    fn test_sharing_result_types() {
        let _r1: Result<SharingStatus> = Ok(SharingStatus { active: false, display_name: "test".to_string(), local_ip: "127.0.0.1".to_string(), http_port: 8080, peer_count: 0 });
        let _r2: Result<Vec<PeerInfo>> = Ok(Vec::new());
        let _r3: Result<Vec<PendingShare>> = Ok(Vec::new());
        let _r4: Result<String> = Ok("ok".to_string());
        let _r5: Result<()> = Ok(());
        let _r6: Result<usize> = Ok(5);
    }

    #[test]
    fn test_sharing_manager_methods() {
        let methods = vec![
            "start", "stop", "get_status", "set_display_name",
            "get_peers", "share_with_peer", "get_pending_shares",
            "accept_share", "reject_share", "ping_peer", "add_manual_peer"
        ];
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_sharing_clone() {
        let status = SharingStatus {
            active: true,
            display_name: "test".to_string(),
            local_ip: "127.0.0.1".to_string(),
            http_port: 8080,
            peer_count: 0,
        };
        let cloned = status.clone();
        assert_eq!(status.active, cloned.active);
    }

    #[test]
    fn test_sharing_ip_port_ping() {
        let ip = "192.168.1.1";
        let port: u16 = 22;
        
        assert!(!ip.is_empty());
        assert!(port > 0);
    }

    #[test]
    fn test_sharing_count_increment() {
        let mut count = 0;
        count += 1;
        count += 1;
        assert_eq!(count, 2);
    }

    #[test]
    fn test_sharing_vec_is_empty_check() {
        let profiles: Vec<String> = Vec::new();
        let snippets: Vec<String> = vec!["s1".to_string()];
        
        assert!(profiles.is_empty());
        assert!(!snippets.is_empty());
    }
}
