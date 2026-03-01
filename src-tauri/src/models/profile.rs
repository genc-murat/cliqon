use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum AuthMethod {
    Password,
    PrivateKey,
    Agent,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TunnelType {
    Local,
    Remote,
    Dynamic,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
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
    pub tunnels: Option<Vec<TunnelConfig>>,
    pub is_favorite: Option<bool>,
    pub color: Option<String>,
    pub last_used: Option<i64>,
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
            tunnels: Some(Vec::new()),
            is_favorite: Some(false),
            color: None,
            last_used: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_profile_default() {
        let profile = SshProfile::default();

        assert!(!profile.id.is_empty());
        assert_eq!(profile.name, "New Profile");
        assert_eq!(profile.host, "127.0.0.1");
        assert_eq!(profile.port, 22);
        assert_eq!(profile.username, "root");
        assert_eq!(profile.auth_method, AuthMethod::Password);
        assert!(profile.category.is_none());
        assert!(profile.private_key_path.is_none());
        assert!(profile.obfuscated_secret.is_none());
        assert_eq!(profile.tunnels, Some(Vec::new()));
        assert_eq!(profile.is_favorite, Some(false));
        assert!(profile.color.is_none());
    }

    #[test]
    fn test_auth_method_serialization() {
        let methods = vec![
            AuthMethod::Password,
            AuthMethod::PrivateKey,
            AuthMethod::Agent,
        ];

        for method in methods {
            let json = serde_json::to_string(&method).unwrap();
            let decoded: AuthMethod = serde_json::from_str(&json).unwrap();
            assert_eq!(decoded, method);
        }
    }

    #[test]
    fn test_tunnel_type_serialization() {
        let types = vec![TunnelType::Local, TunnelType::Remote, TunnelType::Dynamic];

        for t in types {
            let json = serde_json::to_string(&t).unwrap();
            let decoded: TunnelType = serde_json::from_str(&json).unwrap();
            assert_eq!(decoded, t);
        }
    }

    #[test]
    fn test_ssh_profile_full_serialization() {
        let profile = SshProfile {
            id: "test-id".to_string(),
            name: "My Server".to_string(),
            host: "example.com".to_string(),
            port: 2222,
            username: "admin".to_string(),
            auth_method: AuthMethod::PrivateKey,
            category: Some("Production".to_string()),
            private_key_path: Some("~/.ssh/id_rsa".to_string()),
            obfuscated_secret: Some("obfuscated".to_string()),
            tunnels: Some(vec![TunnelConfig {
                id: "tunnel-1".to_string(),
                name: "DB Tunnel".to_string(),
                tunnel_type: TunnelType::Local,
                local_port: 3306,
                remote_host: Some("127.0.0.1".to_string()),
                remote_port: Some(3306),
            }]),
            is_favorite: Some(true),
            color: Some("#00ff00".to_string()),
            last_used: None,
        };

        let json = serde_json::to_string(&profile).unwrap();
        let decoded: SshProfile = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, profile.id);
        assert_eq!(decoded.name, profile.name);
        assert_eq!(decoded.tunnels.unwrap().len(), 1);
    }

    #[test]
    fn test_tunnel_config_serialization() {
        let tunnel = TunnelConfig {
            id: "t-1".to_string(),
            name: "Test Tunnel".to_string(),
            tunnel_type: TunnelType::Remote,
            local_port: 8080,
            remote_host: Some("localhost".to_string()),
            remote_port: Some(80),
        };

        let json = serde_json::to_string(&tunnel).unwrap();
        let decoded: TunnelConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, tunnel.id);
        assert_eq!(decoded.tunnel_type, TunnelType::Remote);
    }

    #[test]
    fn test_ssh_profile_equality() {
        let p1 = SshProfile::default();
        let mut p2 = p1.clone();
        p2.name = "Different Name".to_string();

        assert_ne!(p1.name, p2.name);
        assert_eq!(p1.id, p2.id);
    }
}
