use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, Result};
use crate::models::profile::{AuthMethod, SshProfile};

const KEYRING_SERVICE: &str = "cliqon_ssh_profiles";

pub struct ProfileStore {
    app_data_dir: PathBuf,
}

impl ProfileStore {
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

    fn get_profiles_file_path(&self) -> PathBuf {
        self.app_data_dir.join("profiles.json")
    }

    pub fn get_all_profiles(&self) -> Result<Vec<SshProfile>> {
        let path = self.get_profiles_file_path();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(path)?;
        let profiles: Vec<SshProfile> = serde_json::from_str(&content)?;
        Ok(profiles)
    }

    pub fn save_profiles(&self, profiles: &[SshProfile]) -> Result<()> {
        super::write_json_atomically(&self.get_profiles_file_path(), &profiles)
    }

    pub fn save_profile(&self, profile: SshProfile, secret: Option<String>) -> Result<()> {
        let mut profiles = self.get_all_profiles()?;
        let mut updated_profile = profile.without_secret();
        let position = profiles.iter().position(|p| p.id == updated_profile.id);
        let existing = position.map(|pos| &profiles[pos]);
        let credential_changed = secret.is_some()
            || existing.is_some_and(|profile| !profile.same_credentials_scope(&updated_profile));
        let replaced_credential = if credential_changed {
            let entry = Entry::new(KEYRING_SERVICE, &updated_profile.id)?;
            let previous = read_credential(&entry)?;
            if let Some(secret) = secret.filter(|_| updated_profile.auth_method != AuthMethod::Agent) {
                entry.set_password(&secret)?;
            } else {
                delete_credential(&entry)?;
            }
            Some((entry, previous))
        } else {
            if let Some(existing) = existing {
                updated_profile.obfuscated_secret = existing.obfuscated_secret.clone();
            }
            None
        };

        if let Some(pos) = position {
            profiles[pos] = updated_profile;
        } else {
            profiles.push(updated_profile);
        }

        if let Err(error) = self.save_profiles(&profiles) {
            if let Some((entry, previous)) = replaced_credential {
                let rollback = match previous {
                    Some(secret) => entry.set_password(&secret),
                    None => delete_credential(&entry),
                };
                if let Err(rollback_error) = rollback {
                    return Err(AppError::Custom(format!("{error}. Credential rollback failed: {rollback_error}")));
                }
            }
            return Err(error);
        }
        Ok(())
    }

    pub fn delete_profile(&self, id: &str) -> Result<()> {
        let mut profiles = self.get_all_profiles()?;

        if let Some(pos) = profiles.iter().position(|p| p.id == id) {
            let entry = Entry::new(KEYRING_SERVICE, id)?;
            let previous = read_credential(&entry)?;
            if previous.is_some() {
                delete_credential(&entry)?;
            }
            profiles.remove(pos);
            if let Err(error) = self.save_profiles(&profiles) {
                if let Some(secret) = previous {
                    entry.set_password(&secret)?;
                }
                return Err(error);
            }
        }

        Ok(())
    }

    pub fn get_secret_for(&self, requested: &SshProfile) -> Result<Option<String>> {
        let mut profiles = self.get_all_profiles()?;
        let Some(profile) = profiles.iter_mut().find(|profile| {
            profile.id == requested.id && profile.same_credentials_scope(requested)
        }) else {
            return Ok(None);
        };
        if profile.auth_method == AuthMethod::Agent {
            return Ok(None);
        }
        if profile.obfuscated_secret.is_some() {
            let secret = migrate_legacy_credential(profile)?;
            self.save_profiles(&profiles)?;
            return Ok(secret);
        }
        Ok(read_credential(&Entry::new(KEYRING_SERVICE, &profile.id)?)?)
    }

    pub fn migrate_legacy_credentials(&self) -> Result<()> {
        let mut profiles = self.get_all_profiles()?;
        let mut migrated = false;
        let mut failure = None;
        for profile in profiles.iter_mut().filter(|profile| profile.obfuscated_secret.is_some()) {
            match migrate_legacy_credential(profile) {
                Ok(_) => migrated = true,
                Err(error) => failure = Some(error),
            }
        }
        if migrated {
            self.save_profiles(&profiles)?;
        }
        failure.map_or(Ok(()), Err)
    }
}

fn read_credential(entry: &Entry) -> std::result::Result<Option<String>, keyring::Error> {
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error),
    }
}

fn delete_credential(entry: &Entry) -> std::result::Result<(), keyring::Error> {
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error),
    }
}

fn migrate_legacy_credential(profile: &mut SshProfile) -> Result<Option<String>> {
    let secret = profile.obfuscated_secret.as_deref().and_then(deobfuscate)
        .filter(|_| profile.auth_method != AuthMethod::Agent);
    if let Some(secret) = &secret {
        let entry = Entry::new(KEYRING_SERVICE, &profile.id)?;
        entry.set_password(secret)?;
    }
    profile.obfuscated_secret = None;
    Ok(secret)
}

#[cfg(test)]
fn obfuscate(s: &str) -> String {
    s.bytes().map(|b| format!("{:02x}", b ^ 0x6A)).collect()
}

fn deobfuscate(s: &str) -> Option<String> {
    if s.is_empty() {
        return None;
    }
    if !s.is_ascii() || !s.len().is_multiple_of(2) {
        return None;
    }
    let bytes: std::result::Result<Vec<u8>, _> = (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map(|b| b ^ 0x6A))
        .collect();
    bytes.ok().and_then(|b| String::from_utf8(b).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_obfuscate_deobfuscate_roundtrip() {
        let cases = vec![
            "password123",
            "my_secret!",
            "unicode_ğüışöç",
            "spaces and tabs\t\n",
            "a",
            "",
        ];

        for original in cases {
            if original.is_empty() {
                assert_eq!(obfuscate(""), "");
                assert!(deobfuscate("").is_none());
            } else {
                let obfuscated = obfuscate(original);
                assert!(
                    obfuscated.chars().all(|c| c.is_ascii_hexdigit()),
                    "Result should be hex string, got: {}",
                    obfuscated
                );
                assert_eq!(
                    obfuscated.len(),
                    original.len() * 2,
                    "Each byte becomes 2 hex chars"
                );
                assert!(deobfuscate(&obfuscated).as_deref() == Some(original));
            }
        }

        // Consistent output
        assert_eq!(obfuscate("same_input"), obfuscate("same_input"));
    }

    #[test]
    fn test_deobfuscate_edge_cases() {
        assert!(deobfuscate("aéa").is_none());
        assert!(deobfuscate("ZZZZ").is_none());   // invalid hex
        assert!(deobfuscate("abc").is_none());    // odd length
        assert!(deobfuscate("").is_none());       // empty
    }

    #[test]
    fn test_xor_byte_operation() {
        for byte in [0x00u8, 0x41, 0xFF, 0x6A] {
            let xored = byte ^ 0x6A;
            assert_eq!(xored ^ 0x6A, byte, "XOR should be reversible");
        }
        
        // Format check
        assert_eq!(format!("{:02x}", 65u8), "41");
        assert_eq!(format!("{:02x}", 10u8), "0a");
        
        // Parse check
        assert_eq!(u8::from_str_radix("41", 16).unwrap(), 65);
        assert!(u8::from_str_radix("ZZ", 16).is_err());
    }

    #[test]
    fn test_profile_serialization_roundtrip() {
        let profile = SshProfile {
            id: "test-1".to_string(),
            name: "Test Server".to_string(),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: crate::models::profile::AuthMethod::Password,
            category: None,
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: None,
            color: None,
            last_used: None,
        };

        let json = serde_json::to_string(&profile).unwrap();
        let decoded: SshProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(profile.id, decoded.id);
        assert_eq!(profile.host, decoded.host);
    }

    #[test]
    fn test_profile_store_find_replace_pattern() {
        let profile = SshProfile::default();
        let mut profiles = vec![profile.clone()];

        // Find and update position
        if let Some(pos) = profiles.iter().position(|p| p.id == profile.id) {
            profiles[pos] = profile.clone();
        } else {
            profiles.push(profile.clone());
        }
        assert_eq!(profiles.len(), 1, "Should update, not add");

        // Find by id
        assert!(profiles.iter().find(|p| p.id == profile.id).is_some());
        assert!(profiles.iter().find(|p| p.id == "nonexistent").is_none());
    }

    #[test]
    fn test_keyring_service_constant() {
        assert_eq!(KEYRING_SERVICE, "cliqon_ssh_profiles");
    }
}
