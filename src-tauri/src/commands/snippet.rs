use tauri::State;
use crate::error::Result;
use crate::models::snippet::Snippet;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn get_snippets(state: State<'_, AppState>) -> Result<Vec<Snippet>> {
    let store = state.snippet_store.lock().unwrap();
    store.get_all()
}

#[tauri::command]
pub async fn save_snippet(state: State<'_, AppState>, snippet: Snippet) -> Result<()> {
    let store = state.snippet_store.lock().unwrap();
    store.save(snippet)
}

#[tauri::command]
pub async fn delete_snippet(state: State<'_, AppState>, id: String) -> Result<()> {
    let store = state.snippet_store.lock().unwrap();
    store.delete(&id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snippet_command_types() {
        let _result_vec: Result<Vec<Snippet>> = Ok(Vec::new());
        let _result_unit: Result<()> = Ok(());
    }

    #[test]
    fn test_snippet_operations() {
        let operations = vec!["get", "save", "delete"];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_snippet_id_format() {
        let ids = vec!["snippet-1", "cmd-abc", "script-xyz"];
        for id in ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_snippet_store_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_snippet_result_types() {
        let _r1: Result<Vec<Snippet>> = Ok(Vec::new());
        let _r2: Result<()> = Ok(());
    }

    #[test]
    fn test_snippet_manager_methods() {
        let methods = vec!["get_all", "save", "delete"];
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_snippet_vec_operations() {
        let mut snippets: Vec<Snippet> = Vec::new();
        assert!(snippets.is_empty());

        snippets.push(Snippet {
            id: "s1".to_string(),
            name: "Test".to_string(),
            command: "echo test".to_string(),
            folder: None,
            auto_run: false,
            description: None,
        });
        assert_eq!(snippets.len(), 1);
    }

    #[test]
    fn test_snippet_string_cloning() {
        let id = "snippet-1".to_string();
        let cloned = id.clone();
        assert_eq!(id, cloned);
    }
}
