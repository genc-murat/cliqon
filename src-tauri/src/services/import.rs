use crate::models::profile::{SshProfile, AuthMethod};
use crate::error::{Result, AppError};
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
        let name = item.get("label")
            .or(item.get("name"))
            .and_then(|v| v.as_str())?
            .to_string();
            
        let host = item.get("address")
            .or(item.get("hostname"))
            .and_then(|v| v.as_str())?
            .to_string();
            
        let port = item.get("port")
            .and_then(|p| p.as_u64())
            .unwrap_or(22) as u16;
            
        let username = item.get("username")
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
        })
    }
}
