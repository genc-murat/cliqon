use crate::error::{AppError, Result};
use crate::models::profile::{AuthMethod, SshProfile};
use ini::Ini;
use serde_json::Value;

pub struct ImportService;

impl ImportService {
    pub fn parse_mxtsessions(content: &str) -> Result<Vec<SshProfile>> {
        let mut profiles = Vec::new();
        let i = Ini::load_from_str(content).map_err(|e| AppError::Custom(e.to_string()))?;

        for (section_name, section) in i.iter() {
            let category: Option<String> = section_name.map(|s| s.to_string());
            for (key, value) in section.iter() {
                // MobaXterm sessions usually start with #
                if value.starts_with('#') {
                    if let Some(mut profile) = Self::parse_moba_session(key, value) {
                        // If section is not "Sessions", use as category
                        if let Some(ref cat) = category {
                            if cat != "Sessions" && cat != "Bookmarks" {
                                profile.category = Some(cat.clone());
                            }
                        }
                        profiles.push(profile);
                    }
                }
            }
        }

        Ok(profiles)
    }

    fn parse_moba_session(name: &str, session_str: &str) -> Option<SshProfile> {
        // Format: #<id>#<protocol>%<host>%<port>%<user>%...
        // Example: #109#0%1.2.3.4%22%root%...

        let parts: Vec<&str> = session_str.split('%').collect();
        if parts.len() < 4 {
            return None;
        }

        let host = parts[1].to_string();
        let port = parts[2].parse::<u16>().unwrap_or(22);
        let username = parts[3].to_string();

        Some(SshProfile {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            host,
            port,
            username,
            auth_method: AuthMethod::Password,
            category: Some("MobaXterm".to_string()),
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: Some(Vec::new()),
            is_favorite: Some(false),
            color: None,
            last_used: None,
        })
    }

    pub fn parse_termius_json(content: &str) -> Result<Vec<SshProfile>> {
        let v: Value = serde_json::from_str(content)?;
        let mut profiles = Vec::new();

        if let Some(items) = v.as_array() {
            for item in items {
                if let Some(profile) = Self::parse_termius_item(item) {
                    profiles.push(profile);
                }
            }
        } else if let Some(items) = v.get("hosts").and_then(|h| h.as_array()) {
            for item in items {
                if let Some(profile) = Self::parse_termius_item(item) {
                    profiles.push(profile);
                }
            }
        }

        Ok(profiles)
    }

    fn parse_termius_item(item: &Value) -> Option<SshProfile> {
        let name = item
            .get("label")
            .or(item.get("name"))
            .and_then(|v| v.as_str())?
            .to_string();

        let host = item
            .get("address")
            .or(item.get("hostname"))
            .and_then(|v| v.as_str())?
            .to_string();

        let port = item.get("port").and_then(|p| p.as_u64()).unwrap_or(22) as u16;

        let username = item
            .get("username")
            .and_then(|v| v.as_str())
            .unwrap_or("root")
            .to_string();

        Some(SshProfile {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            host,
            port,
            username,
            auth_method: AuthMethod::Password,
            category: Some("Termius".to_string()),
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: Some(Vec::new()),
            is_favorite: Some(false),
            color: None,
            last_used: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_moba_session_valid() {
        let session_str = "#109#0%192.168.1.100%22%admin%";
        let result = ImportService::parse_moba_session("My Server", session_str);

        assert!(result.is_some());
        let profile = result.unwrap();
        assert_eq!(profile.name, "My Server");
        assert_eq!(profile.host, "192.168.1.100");
        assert_eq!(profile.port, 22);
        assert_eq!(profile.username, "admin");
        assert_eq!(profile.auth_method, AuthMethod::Password);
    }

    #[test]
    fn test_parse_moba_session_custom_port() {
        let session_str = "#109#0%10.0.0.1%2222%root%";
        let result = ImportService::parse_moba_session("Custom Port", session_str);

        assert!(result.is_some());
        let profile = result.unwrap();
        assert_eq!(profile.port, 2222);
    }

    #[test]
    fn test_parse_moba_session_invalid_format() {
        let cases = vec!["invalid", "#109#0", "#109#0%host", "#109#0%host%port"];

        for session_str in cases {
            let result = ImportService::parse_moba_session("Test", session_str);
            assert!(result.is_none(), "Should be None for: {}", session_str);
        }
    }

    #[test]
    fn test_parse_moba_session_default_port() {
        let session_str = "#109#0%server.com%abc%user%";
        let result = ImportService::parse_moba_session("Test", session_str);

        assert!(result.is_some());
        let profile = result.unwrap();
        assert_eq!(profile.port, 22); // Default port when parse fails
    }

    #[test]
    fn test_parse_mxtsessions_empty() {
        let result = ImportService::parse_mxtsessions("");
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_parse_mxtsessions_multiple_sessions() {
        let content = r#"
[Sessions]
Server1=#109#0%192.168.1.1%22%root%
Server2=#110#0%192.168.1.2%22%admin%
"#;
        let result = ImportService::parse_mxtsessions(content);

        assert!(result.is_ok());
        let profiles = result.unwrap();
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].name, "Server1");
        assert_eq!(profiles[1].name, "Server2");
    }

    #[test]
    fn test_parse_mxtsessions_with_categories() {
        let content = r#"
[Production]
ProdServer=#109#0%prod.example.com%22%deploy%
[Development]
DevServer=#109#0%dev.example.com%22%developer%
"#;
        let result = ImportService::parse_mxtsessions(content);

        assert!(result.is_ok());
        let profiles = result.unwrap();
        assert_eq!(profiles.len(), 2);

        let prod = profiles.iter().find(|p| p.name == "ProdServer").unwrap();
        assert_eq!(prod.category, Some("Production".to_string()));

        let dev = profiles.iter().find(|p| p.name == "DevServer").unwrap();
        assert_eq!(dev.category, Some("Development".to_string()));
    }

    #[test]
    fn test_parse_mxtsessions_ignores_non_session_entries() {
        let content = r#"
[Sessions]
ValidSession=#109#0%host%22%user%
SomeOtherEntry=not-a-session
AnotherEntry=also-not-valid
"#;
        let result = ImportService::parse_mxtsessions(content);

        assert!(result.is_ok());
        let profiles = result.unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "ValidSession");
    }

    #[test]
    fn test_parse_termius_json_array() {
        let json = r#"[
            {"label": "Server A", "address": "192.168.1.1", "port": 22, "username": "admin"},
            {"label": "Server B", "address": "192.168.1.2", "port": 2222, "username": "root"}
        ]"#;

        let result = ImportService::parse_termius_json(json);
        assert!(result.is_ok());
        let profiles = result.unwrap();
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].name, "Server A");
        assert_eq!(profiles[1].port, 2222);
    }

    #[test]
    fn test_parse_termius_json_with_hosts_key() {
        let json = r#"{
            "hosts": [
                {"name": "My Host", "hostname": "example.com", "username": "user"}
            ]
        }"#;

        let result = ImportService::parse_termius_json(json);
        assert!(result.is_ok());
        let profiles = result.unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "My Host");
        assert_eq!(profiles[0].host, "example.com");
    }

    #[test]
    fn test_parse_termius_json_empty() {
        let json = "[]";
        let result = ImportService::parse_termius_json(json);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_parse_termius_json_empty_object() {
        let json = "{}";
        let result = ImportService::parse_termius_json(json);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_parse_termius_item_minimal() {
        let json = r#"{"label": "Minimal", "address": "1.2.3.4"}"#;
        let value: Value = serde_json::from_str(json).unwrap();

        let result = ImportService::parse_termius_item(&value);
        assert!(result.is_some());
        let profile = result.unwrap();
        assert_eq!(profile.name, "Minimal");
        assert_eq!(profile.host, "1.2.3.4");
        assert_eq!(profile.port, 22); // Default
        assert_eq!(profile.username, "root"); // Default
    }

    #[test]
    fn test_parse_termius_item_full() {
        let json = r#"{
            "label": "Full Server",
            "address": "server.example.com",
            "port": 3333,
            "username": "customuser"
        }"#;
        let value: Value = serde_json::from_str(json).unwrap();

        let result = ImportService::parse_termius_item(&value);
        assert!(result.is_some());
        let profile = result.unwrap();
        assert_eq!(profile.name, "Full Server");
        assert_eq!(profile.host, "server.example.com");
        assert_eq!(profile.port, 3333);
        assert_eq!(profile.username, "customuser");
    }

    #[test]
    fn test_parse_termius_item_uses_name_fallback() {
        let json = r#"{"name": "Name Field", "hostname": "host.com"}"#;
        let value: Value = serde_json::from_str(json).unwrap();

        let result = ImportService::parse_termius_item(&value);
        assert!(result.is_some());
        let profile = result.unwrap();
        assert_eq!(profile.name, "Name Field");
    }

    #[test]
    fn test_parse_termius_item_missing_required_fields() {
        let cases = vec![
            r#"{}"#,
            r#"{"label": "No Host"}"#,
            r#"{"address": "host.com"}"#,
        ];

        for json in cases {
            let value: Value = serde_json::from_str(json).unwrap();
            let result = ImportService::parse_termius_item(&value);
            assert!(result.is_none(), "Should be None for: {}", json);
        }
    }

    #[test]
    fn test_parse_termius_json_invalid() {
        let json = "not valid json";
        let result = ImportService::parse_termius_json(json);
        assert!(result.is_err());
    }
}
