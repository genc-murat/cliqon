use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::Result;
use crate::models::snippet::Snippet;

pub struct SnippetStore {
    app_data_dir: PathBuf,
}

impl SnippetStore {
    pub fn new(app_handle: &AppHandle) -> Self {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to resolve app data directory");

        if !app_data_dir.exists() {
            fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
        }

        Self { app_data_dir }
    }

    fn get_file_path(&self) -> PathBuf {
        self.app_data_dir.join("snippets.json")
    }

    pub fn get_all(&self) -> Result<Vec<Snippet>> {
        let path = self.get_file_path();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(path)?;
        let items: Vec<Snippet> = serde_json::from_str(&content)?;
        Ok(items)
    }

    pub fn save_all(&self, items: &[Snippet]) -> Result<()> {
        let path = self.get_file_path();
        let content = serde_json::to_string_pretty(items)?;
        fs::write(path, content)?;
        Ok(())
    }

    pub fn save(&self, item: Snippet) -> Result<()> {
        let mut items = self.get_all()?;

        if let Some(pos) = items.iter().position(|i| i.id == item.id) {
            items[pos] = item;
        } else {
            items.push(item);
        }

        self.save_all(&items)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let mut items = self.get_all()?;
        
        if let Some(pos) = items.iter().position(|i| i.id == id) {
            items.remove(pos);
            self.save_all(&items)?;
        }

        Ok(())
    }
}
