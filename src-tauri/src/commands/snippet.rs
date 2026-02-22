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
