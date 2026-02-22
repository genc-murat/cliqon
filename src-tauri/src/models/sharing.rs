use serde::{Deserialize, Serialize};
use crate::models::profile::{SshProfile, AuthMethod, Snippet};

/// Information about a discovered peer on the local network
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeerInfo {
    pub id: String,
    pub display_name: String,
    pub ip: String,
    pub port: u16,
    pub last_seen: u64,
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
    pub snippets: Option<Vec<Snippet>>,
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
            snippets: profile.snippets.clone(),
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
            snippets: self.snippets.clone(),
            tunnels: Some(Vec::new()),
            is_favorite: self.is_favorite,
            color: self.color.clone(),
        }
    }
}

/// Payload sent when sharing profiles
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharePayload {
    pub sender_name: String,
    pub sender_ip: String,
    pub profiles: Vec<ShareableProfile>,
    pub timestamp: u64,
}

/// A pending share received from a peer
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingShare {
    pub id: String,
    pub from_name: String,
    pub from_ip: String,
    pub profiles: Vec<ShareableProfile>,
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
