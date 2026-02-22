use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::Result;
use crate::models::profile::SshProfile;

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
        let path = self.get_profiles_file_path();
        let content = serde_json::to_string_pretty(profiles)?;
        fs::write(path, content)?;
        Ok(())
    }

    pub fn save_profile(&self, profile: SshProfile, secret: Option<String>) -> Result<()> {
        let mut profiles = self.get_all_profiles()?;
        let mut updated_profile = profile.clone();

        if let Some(sec) = secret.clone() {
            if let Ok(entry) = Entry::new(KEYRING_SERVICE, &profile.id) {
                let _ = entry.set_password(&sec);
            }
            updated_profile.obfuscated_secret = Some(obfuscate(&sec));
        } else {
            // Keep existing obfuscated_secret if we are editing without updating the password
            if let Some(existing) = profiles.iter().find(|p| p.id == profile.id) {
                updated_profile.obfuscated_secret = existing.obfuscated_secret.clone();
            }
        }

        if let Some(pos) = profiles.iter().position(|p| p.id == profile.id) {
            profiles[pos] = updated_profile;
        } else {
            profiles.push(updated_profile);
        }

        self.save_profiles(&profiles)
    }

    pub fn delete_profile(&self, id: &str) -> Result<()> {
        let mut profiles = self.get_all_profiles()?;

        if let Some(pos) = profiles.iter().position(|p| p.id == id) {
            profiles.remove(pos);
            self.save_profiles(&profiles)?;

            // Try to delete secret from keyring, ignore error if it's not found
            if let Ok(entry) = Entry::new(KEYRING_SERVICE, id) {
                let _ = entry.delete_credential();
            }
        }

        Ok(())
    }

    pub fn get_profile_secret(&self, id: &str) -> Result<Option<String>> {
        // 1. Try Keyring
        if let Ok(entry) = Entry::new(KEYRING_SERVICE, id) {
            if let Ok(secret) = entry.get_password() {
                return Ok(Some(secret));
            }
        }

        // 2. Fallback to json local storage
        let profiles = self.get_all_profiles().unwrap_or_default();
        if let Some(profile) = profiles.into_iter().find(|p| p.id == id) {
            if let Some(obs) = profile.obfuscated_secret {
                return Ok(deobfuscate(&obs));
            }
        }

        Ok(None)
    }
}

fn obfuscate(s: &str) -> String {
    s.bytes().map(|b| format!("{:02x}", b ^ 0x6A)).collect()
}

fn deobfuscate(s: &str) -> Option<String> {
    if s.is_empty() {
        return None;
    }
    if s.len() % 2 != 0 {
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
        ];

        for original in cases {
            let obfuscated = obfuscate(original);
            let deobfuscated = deobfuscate(&obfuscated);
            assert_eq!(
                Some(original.to_string()),
                deobfuscated,
                "Failed for input: {:?}",
                original
            );
        }
    }

    #[test]
    fn test_obfuscate_produces_hex() {
        let result = obfuscate("AB");
        assert!(
            result.chars().all(|c| c.is_ascii_hexdigit()),
            "Result should be hex string, got: {}",
            result
        );
    }

    #[test]
    fn test_obfuscate_empty_string() {
        assert_eq!(obfuscate(""), "");
    }

    #[test]
    fn test_deobfuscate_invalid_hex() {
        assert!(deobfuscate("ZZZZ").is_none());
    }

    #[test]
    fn test_deobfuscate_odd_length() {
        assert!(deobfuscate("abc").is_none());
    }

    #[test]
    fn test_deobfuscate_empty() {
        assert!(deobfuscate("").is_none());
    }
}
