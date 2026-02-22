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

    pub fn get_by_id(&self, id: &str) -> Result<Option<Snippet>> {
        let items = self.get_all()?;
        Ok(items.into_iter().find(|i| i.id == id))
    }

    pub fn get_by_folder(&self, folder: &str) -> Result<Vec<Snippet>> {
        let items = self.get_all()?;
        Ok(items
            .into_iter()
            .filter(|i| i.folder.as_deref() == Some(folder))
            .collect())
    }

    pub fn clear(&self) -> Result<()> {
        self.save_all(&[])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_snippet(id: &str, name: &str, command: &str) -> Snippet {
        Snippet {
            id: id.to_string(),
            name: name.to_string(),
            command: command.to_string(),
            folder: None,
            auto_run: false,
            description: None,
        }
    }

    fn create_test_snippet_with_folder(
        id: &str,
        name: &str,
        command: &str,
        folder: &str,
    ) -> Snippet {
        Snippet {
            id: id.to_string(),
            name: name.to_string(),
            command: command.to_string(),
            folder: Some(folder.to_string()),
            auto_run: false,
            description: None,
        }
    }

    #[test]
    fn test_snippet_equality() {
        let s1 = create_test_snippet("id-1", "Name", "cmd");
        let s2 = create_test_snippet("id-1", "Different Name", "different cmd");
        let s3 = create_test_snippet("id-2", "Name", "cmd");

        assert_eq!(s1.id, s2.id);
        assert_ne!(s1.id, s3.id);
    }

    #[test]
    fn test_snippet_clone() {
        let original = create_test_snippet("orig", "Original", "original_cmd");
        let cloned = original.clone();

        assert_eq!(original.id, cloned.id);
        assert_eq!(original.name, cloned.name);
        assert_eq!(original.command, cloned.command);
    }

    #[test]
    fn test_snippet_with_all_fields() {
        let snippet = Snippet {
            id: "full-snippet".to_string(),
            name: "Full Snippet".to_string(),
            command: "echo 'hello world'".to_string(),
            folder: Some("Scripts".to_string()),
            auto_run: true,
            description: Some("A test snippet".to_string()),
        };

        assert_eq!(snippet.id, "full-snippet");
        assert_eq!(snippet.folder, Some("Scripts".to_string()));
        assert!(snippet.auto_run);
        assert_eq!(snippet.description, Some("A test snippet".to_string()));
    }

    #[test]
    fn test_snippet_serialization() {
        let snippet = create_test_snippet("ser-1", "Serialize Test", "ls -la");
        let json = serde_json::to_string(&snippet).unwrap();
        let decoded: Snippet = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, snippet.id);
        assert_eq!(decoded.name, snippet.name);
        assert_eq!(decoded.command, snippet.command);
    }

    #[test]
    fn test_snippet_with_folder_serialization() {
        let snippet = create_test_snippet_with_folder("ser-2", "Folder Test", "pwd", "Navigation");
        let json = serde_json::to_string(&snippet).unwrap();
        let decoded: Snippet = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.folder, Some("Navigation".to_string()));
    }

    #[test]
    fn test_snippet_minimal_json() {
        let json = r#"{"id":"min","name":"Min","command":"ls","auto_run":false}"#;
        let snippet: Snippet = serde_json::from_str(json).unwrap();

        assert_eq!(snippet.id, "min");
        assert!(snippet.folder.is_none());
        assert!(snippet.description.is_none());
    }

    #[test]
    fn test_snippet_auto_run_flag() {
        let mut snippet = create_test_snippet("auto-1", "Auto Run Test", "echo test");
        assert!(!snippet.auto_run);

        snippet.auto_run = true;
        assert!(snippet.auto_run);
    }

    #[test]
    fn test_snippet_command_with_special_chars() {
        let snippet = Snippet {
            id: "special-1".to_string(),
            name: "Special".to_string(),
            command: "echo 'test' | grep -E \"pattern|other\" && exit 0".to_string(),
            folder: None,
            auto_run: false,
            description: Some("Complex command with pipes and quotes".to_string()),
        };

        let json = serde_json::to_string(&snippet).unwrap();
        let decoded: Snippet = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.command, snippet.command);
        assert!(decoded.command.contains('|'));
        assert!(decoded.command.contains("&&"));
    }

    #[test]
    fn test_snippet_unicode_content() {
        let snippet = Snippet {
            id: "unicode-1".to_string(),
            name: "Unicode Test ğüışöç".to_string(),
            command: "echo '你好世界'".to_string(),
            folder: Some("测试文件夹".to_string()),
            auto_run: false,
            description: Some("Описание на русском".to_string()),
        };

        let json = serde_json::to_string(&snippet).unwrap();
        let decoded: Snippet = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.name, "Unicode Test ğüışöç");
        assert_eq!(decoded.command, "echo '你好世界'");
        assert_eq!(decoded.folder, Some("测试文件夹".to_string()));
    }
}
