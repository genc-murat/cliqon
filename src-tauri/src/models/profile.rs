use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum AuthMethod {
    Password,
    PrivateKey,
    Agent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub command: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TunnelType {
    Local,
    Remote,
    Dynamic,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TunnelConfig {
    pub id: String,
    pub name: String,
    pub tunnel_type: TunnelType,
    pub local_port: u16,
    pub remote_host: Option<String>,
    pub remote_port: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub category: Option<String>,
    // For PrivateKey method, the path to the key or the key content
    // Note: We don't store passwords/key passphrases directly in this struct.
    pub private_key_path: Option<String>,
    pub obfuscated_secret: Option<String>,
    pub snippets: Option<Vec<Snippet>>,
    pub tunnels: Option<Vec<TunnelConfig>>,
    pub is_favorite: Option<bool>,
    pub color: Option<String>,
}

impl Default for SshProfile {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "New Profile".to_string(),
            host: "127.0.0.1".to_string(),
            port: 22,
            username: "root".to_string(),
            auth_method: AuthMethod::Password,
            category: None,
            private_key_path: None,
            obfuscated_secret: None,
            snippets: Some(Vec::new()),
            tunnels: Some(Vec::new()),
            is_favorite: Some(false),
            color: None,
        }
    }
}
