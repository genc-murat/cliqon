use crate::models::profile::{AuthMethod, SshProfile};
use crate::models::snippet::Snippet;
use serde::{Deserialize, Serialize};

/// Information about a discovered peer on the local network
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeerInfo {
    pub id: String,
    pub display_name: String,
    pub ip: String,
    pub port: u16,
    pub last_seen: u64,
}

/// A snippet that can be shared over the network
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShareableSnippet {
    pub id: String,
    pub name: String,
    pub command: String,
    pub folder: Option<String>,
    pub auto_run: bool,
    pub description: Option<String>,
}

impl From<Snippet> for ShareableSnippet {
    fn from(s: Snippet) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(), // new ID for imported snippet
            name: s.name,
            command: s.command,
            folder: s.folder,
            auto_run: s.auto_run,
            description: s.description,
        }
    }
}

impl From<ShareableSnippet> for Snippet {
    fn from(s: ShareableSnippet) -> Self {
        Self {
            id: s.id,
            name: s.name,
            command: s.command,
            folder: s.folder,
            auto_run: s.auto_run,
            description: s.description,
        }
    }
}

/// A profile that can be shared over the network (includes secrets)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShareableProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub category: Option<String>,
    pub private_key_path: Option<String>,
    pub secret: Option<String>,
    pub is_favorite: Option<bool>,
    pub color: Option<String>,
}

impl ShareableProfile {
    /// Convert from SshProfile + resolved secret
    pub fn from_profile(profile: &SshProfile, secret: Option<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(), // new ID for imported profile
            name: profile.name.clone(),
            host: profile.host.clone(),
            port: profile.port,
            username: profile.username.clone(),
            auth_method: profile.auth_method.clone(),
            category: profile.category.clone(),
            private_key_path: profile.private_key_path.clone(),
            secret,
            is_favorite: profile.is_favorite,
            color: profile.color.clone(),
        }
    }

    /// Convert to SshProfile (for importing)
    pub fn to_ssh_profile(&self) -> SshProfile {
        SshProfile {
            id: self.id.clone(),
            name: self.name.clone(),
            host: self.host.clone(),
            port: self.port,
            username: self.username.clone(),
            auth_method: self.auth_method.clone(),
            category: self.category.clone(),
            private_key_path: self.private_key_path.clone(),
            obfuscated_secret: None,
            tunnels: Some(Vec::new()),
            is_favorite: self.is_favorite,
            color: self.color.clone(),
        }
    }
}

/// Payload sent when sharing profiles or snippets
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharePayload {
    pub sender_name: String,
    pub sender_ip: String,
    pub profiles: Option<Vec<ShareableProfile>>,
    pub snippets: Option<Vec<ShareableSnippet>>,
    pub timestamp: u64,
}

/// A pending share received from a peer
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingShare {
    pub id: String,
    pub from_name: String,
    pub from_ip: String,
    pub profiles: Vec<ShareableProfile>,
    pub snippets: Vec<ShareableSnippet>,
    pub received_at: u64,
}

/// UDP beacon packet for peer discovery
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeaconPacket {
    pub id: String,
    pub display_name: String,
    pub http_port: u16,
}

/// Sharing service status
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharingStatus {
    pub active: bool,
    pub display_name: String,
    pub local_ip: String,
    pub http_port: u16,
    pub peer_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_profile() -> SshProfile {
        SshProfile {
            id: "test-id-123".to_string(),
            name: "Test Server".to_string(),
            host: "192.168.1.100".to_string(),
            port: 2222,
            username: "testuser".to_string(),
            auth_method: AuthMethod::Password,
            category: Some("Production".to_string()),
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: Some(true),
            color: Some("#ff5500".to_string()),
        }
    }

    #[test]
    fn test_shareable_profile_from_profile() {
        let profile = create_test_profile();
        let secret = Some("mypassword".to_string());

        let shareable = ShareableProfile::from_profile(&profile, secret.clone());

        assert_ne!(shareable.id, profile.id);
        assert_eq!(shareable.name, profile.name);
        assert_eq!(shareable.host, profile.host);
        assert_eq!(shareable.port, profile.port);
        assert_eq!(shareable.secret, secret);
    }

    #[test]
    fn test_shareable_profile_to_ssh_profile() {
        let shareable = ShareableProfile {
            id: "share-id-456".to_string(),
            name: "Shared Server".to_string(),
            host: "10.0.0.1".to_string(),
            port: 22,
            username: "shareduser".to_string(),
            auth_method: AuthMethod::PrivateKey,
            category: None,
            private_key_path: Some("/path/to/key".to_string()),
            secret: Some("keypassphrase".to_string()),
            is_favorite: Some(false),
            color: None,
        };

        let ssh_profile = shareable.to_ssh_profile();

        assert_eq!(ssh_profile.id, shareable.id);
        assert_eq!(ssh_profile.name, shareable.name);
        assert_eq!(ssh_profile.host, shareable.host);
        assert!(ssh_profile.obfuscated_secret.is_none());
        assert_eq!(ssh_profile.tunnels, Some(Vec::new()));
    }

    #[test]
    fn test_beacon_packet_serialization() {
        let beacon = BeaconPacket {
            id: "instance-789".to_string(),
            display_name: "My Machine".to_string(),
            http_port: 8080,
        };

        let json = serde_json::to_string(&beacon).unwrap();
        let decoded: BeaconPacket = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, beacon.id);
        assert_eq!(decoded.http_port, beacon.http_port);
    }

    #[test]
    fn test_peer_info_serialization() {
        let peer = PeerInfo {
            id: "peer-1".to_string(),
            display_name: "Remote Machine".to_string(),
            ip: "192.168.1.50".to_string(),
            port: 19876,
            last_seen: 1700000000,
        };

        let json = serde_json::to_string(&peer).unwrap();
        let decoded: PeerInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, peer.id);
        assert_eq!(decoded.ip, peer.ip);
    }

    #[test]
    fn test_share_payload_serialization() {
        let payload = SharePayload {
            sender_name: "Alice".to_string(),
            sender_ip: "192.168.1.10".to_string(),
            profiles: Some(vec![]),
            snippets: Some(vec![]),
            timestamp: 1700000000,
        };

        let json = serde_json::to_string(&payload).unwrap();
        let decoded: SharePayload = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.sender_name, payload.sender_name);
        assert_eq!(decoded.profiles.as_ref().map(|v| v.len()).unwrap_or(0), 0);
    }

    #[test]
    fn test_pending_share_serialization() {
        let share = PendingShare {
            id: "share-xyz".to_string(),
            from_name: "Bob".to_string(),
            from_ip: "10.0.0.5".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1700000000,
        };

        let json = serde_json::to_string(&share).unwrap();
        let decoded: PendingShare = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.id, share.id);
        assert_eq!(decoded.from_name, share.from_name);
    }

    #[test]
    fn test_sharing_status_serialization() {
        let status = SharingStatus {
            active: true,
            display_name: "My PC".to_string(),
            local_ip: "192.168.1.100".to_string(),
            http_port: 8080,
            peer_count: 3,
        };

        let json = serde_json::to_string(&status).unwrap();
        let decoded: SharingStatus = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.active, true);
        assert_eq!(decoded.peer_count, 3);
    }

    #[test]
    fn test_shareable_profile_conversion_preserves_category() {
        let profile = SshProfile {
            id: "cat-test".to_string(),
            name: "DB Server".to_string(),
            host: "db.example.com".to_string(),
            port: 5432,
            username: "postgres".to_string(),
            auth_method: AuthMethod::Password,
            category: Some("Databases".to_string()),
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: Some(false),
            color: Some("#0000ff".to_string()),
        };

        let shareable = ShareableProfile::from_profile(&profile, None);
        assert_eq!(shareable.category, Some("Databases".to_string()));

        let converted_back = shareable.to_ssh_profile();
        assert_eq!(converted_back.category, Some("Databases".to_string()));
    }
}
