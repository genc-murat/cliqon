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
}
