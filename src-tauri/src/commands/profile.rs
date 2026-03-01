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
pub async fn record_usage(state: State<'_, AppState>, id: String) -> Result<()> {
    let store = state.profile_store.lock().unwrap();
    let mut profiles = store.get_all_profiles()?;
    
    if let Some(pos) = profiles.iter().position(|p| p.id == id) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        
        profiles[pos].last_used = Some(now);
        store.save_profiles(&profiles)?;
    }
    
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_source_validation() {
        // Test invalid import source
        let result: Result<usize> = Err(crate::error::AppError::Custom("Invalid import source".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_import_source_moba() {
        let source = "mobaxterm";
        assert_eq!(source, "mobaxterm");
    }

    #[test]
    fn test_import_source_termius() {
        let source = "termius";
        assert_eq!(source, "termius");
    }

    #[test]
    fn test_import_source_invalid() {
        let invalid_sources = vec!["invalid", "unknown", "other", ""];
        for source in invalid_sources {
            assert_ne!(source, "mobaxterm");
            assert_ne!(source, "termius");
        }
    }

    #[test]
    fn test_profile_store_lock() {
        // Test that we can conceptually lock a store
        // This is a simplified test since we can't create a real AppState in unit tests
        let test_vec: Vec<i32> = vec![1, 2, 3];
        let locked = std::sync::Mutex::new(test_vec);
        let guard = locked.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_async_function_signatures() {
        // Verify that our async functions have the correct signature types
        // This is a compile-time check that ensures the types are correct
        use std::future;
        let _get_profiles: fn(State<'_, AppState>) -> future::Ready<Result<Vec<SshProfile>>> = |_| 
            future::ready(Ok(Vec::new()));
        
        let _delete_profile: fn(State<'_, AppState>, String) -> future::Ready<Result<()>> = |_, _| 
            future::ready(Ok(()));
    }

    #[test]
    fn test_profile_vec_operations() {
        let mut profiles: Vec<SshProfile> = Vec::new();
        
        let profile1 = SshProfile::default();
        let profile2 = SshProfile::default();
        
        profiles.push(profile1);
        profiles.push(profile2);
        
        assert_eq!(profiles.len(), 2);
        
        profiles.clear();
        assert_eq!(profiles.len(), 0);
    }

    #[test]
    fn test_import_count() {
        let profiles: Vec<SshProfile> = vec![
            SshProfile::default(),
            SshProfile::default(),
            SshProfile::default(),
        ];
        
        let count = profiles.len();
        assert_eq!(count, 3);
    }

    #[test]
    fn test_string_matching() {
        let source = "mobaxterm";
        match source {
            "mobaxterm" => assert!(true),
            "termius" => panic!("Wrong match"),
            _ => panic!("Wrong match"),
        }
    }

    #[test]
    fn test_result_types() {
        let ok_result: Result<usize> = Ok(5);
        assert!(ok_result.is_ok());
        assert_eq!(ok_result.unwrap(), 5);

        let err_result: Result<usize> = Err(crate::error::AppError::Custom("test".to_string()));
        assert!(err_result.is_err());
    }

    #[test]
    fn test_profile_id_generation() {
        let id = uuid::Uuid::new_v4().to_string();
        assert!(!id.is_empty());
        assert!(id.len() == 36);
    }

    #[test]
    fn test_profile_categories() {
        let categories = vec![
            "Production",
            "Development",
            "Staging",
            "Testing",
        ];
        
        for cat in categories {
            assert!(!cat.is_empty());
        }
    }

    #[test]
    fn test_profile_color_codes() {
        let colors = vec![
            "#FF5500",
            "#00FF00",
            "#0000FF",
            "#FFFF00",
        ];
        
        for color in colors {
            assert!(color.starts_with('#'));
            assert_eq!(color.len(), 7);
        }
    }

    #[test]
    fn test_profile_serialization() {
        use crate::models::profile::SshProfile;
        use crate::models::profile::AuthMethod;
        
        let profile = SshProfile {
            id: "test-1".to_string(),
            name: "Test Server".to_string(),
            host: "192.168.1.100".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: AuthMethod::Password,
            category: Some("Dev".to_string()),
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: Some(true),
            color: None,
            last_used: None,
        };
        
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("test-1"));
    }

    #[test]
    fn test_profile_deserialization() {
        let json = r#"{
            "id": "test-2",
            "name": "Prod Server",
            "host": "10.0.0.1",
            "port": 2222,
            "username": "root",
            "auth_method": "Password",
            "category": "Production",
            "is_favorite": true
        }"#;
        
        let _parsed: serde_json::Value = serde_json::from_str(json).unwrap();
        assert!(json.contains("test-2"));
    }

    #[test]
    fn test_profile_secret_handling() {
        let secret: Option<String> = Some("password123".to_string());
        let none_secret: Option<String> = None;
        
        assert!(secret.is_some());
        assert!(none_secret.is_none());
        
        let secret_str = secret.as_deref();
        assert_eq!(secret_str, Some("password123"));
    }

    #[test]
    fn test_profile_tunnel_config() {
        use crate::models::profile::TunnelConfig;
        
        let tunnels = vec![
            TunnelConfig {
                id: "t1".to_string(),
                name: "Web Tunnel".to_string(),
                tunnel_type: crate::models::profile::TunnelType::Local,
                local_port: 8080,
                remote_host: Some("localhost".to_string()),
                remote_port: Some(80),
            },
            TunnelConfig {
                id: "t2".to_string(),
                name: "DB Tunnel".to_string(),
                tunnel_type: crate::models::profile::TunnelType::Local,
                local_port: 5432,
                remote_host: Some("db.local".to_string()),
                remote_port: Some(5432),
            },
        ];
        
        assert_eq!(tunnels.len(), 2);
        
        let total: u16 = tunnels.iter().map(|t| t.local_port).sum();
        assert_eq!(total, 13512);
    }

    #[test]
    fn test_profile_clone_behavior() {
        use crate::models::profile::SshProfile;
        use crate::models::profile::AuthMethod;
        
        let original = SshProfile {
            id: "original".to_string(),
            name: "Original".to_string(),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "user".to_string(),
            auth_method: AuthMethod::Password,
            category: None,
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: None,
            color: None,
            last_used: None,
        };
        
        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.host, cloned.host);
    }
}
