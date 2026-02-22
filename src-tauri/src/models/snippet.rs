use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub command: String,
    pub folder: Option<String>,
    pub auto_run: bool,
    pub description: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snippet_serialization() {
        let snippet = Snippet {
            id: "snippet-1".to_string(),
            name: "List Files".to_string(),
            command: "ls -la".to_string(),
            folder: Some("Navigation".to_string()),
            auto_run: false,
            description: Some("List all files".to_string()),
        };

        let json = serde_json::to_string(&snippet).unwrap();
        let decoded: Snippet = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, snippet.id);
        assert_eq!(decoded.command, snippet.command);
    }

    #[test]
    fn test_snippet_minimal() {
        let json = r#"{"id":"x","name":"Test","command":"echo hi","auto_run":true}"#;
        let snippet: Snippet = serde_json::from_str(json).unwrap();

        assert_eq!(snippet.id, "x");
        assert!(snippet.folder.is_none());
        assert!(snippet.description.is_none());
    }

    #[test]
    fn test_snippet_with_special_characters() {
        let snippet = Snippet {
            id: "special-1".to_string(),
            name: "Complex Command".to_string(),
            command: "echo 'hello world' | grep -E \"test|demo\"".to_string(),
            folder: Some("Scripts".to_string()),
            auto_run: true,
            description: Some("A complex command with pipes and quotes".to_string()),
        };

        let json = serde_json::to_string(&snippet).unwrap();
        let decoded: Snippet = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.command, snippet.command);
    }

    #[test]
    fn test_snippet_clone() {
        let original = Snippet {
            id: "clone-test".to_string(),
            name: "Original".to_string(),
            command: "pwd".to_string(),
            folder: None,
            auto_run: false,
            description: None,
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.command, cloned.command);
    }
}
