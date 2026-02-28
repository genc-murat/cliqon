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

    #[test]
    fn test_obfuscate_simple_string() {
        let result = obfuscate("test");
        assert_eq!(result.len(), 8); // 4 chars * 2 hex digits
    }

    #[test]
    fn test_obfuscate_consistent_output() {
        let result1 = obfuscate("same_input");
        let result2 = obfuscate("same_input");
        assert_eq!(result1, result2);
    }

    #[test]
    fn test_deobfuscate_valid_hex() {
        // "test" obfuscated and then deobfuscated should return "test"
        let obfuscated = obfuscate("test");
        let result = deobfuscate(&obfuscated);
        assert_eq!(result, Some("test".to_string()));
    }

    #[test]
    fn test_keyring_service_constant() {
        assert_eq!(KEYRING_SERVICE, "cliqon_ssh_profiles");
    }

    #[test]
    fn test_profile_vec_operations() {
        let mut profiles: Vec<SshProfile> = Vec::new();
        
        let profile1 = SshProfile::default();
        let profile2 = SshProfile::default();
        
        profiles.push(profile1);
        profiles.push(profile2);
        
        assert_eq!(profiles.len(), 2);
        
        if let Some(pos) = profiles.iter().position(|p| p.id == profiles[0].id) {
            profiles.remove(pos);
        }
        
        assert_eq!(profiles.len(), 1);
    }

    #[test]
    fn test_profile_find_by_id() {
        let profile1 = SshProfile::default();
        let profile2 = SshProfile::default();
        
        let profiles = vec![profile1.clone(), profile2.clone()];
        
        let found = profiles.iter().find(|p| p.id == profile1.id);
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, profile1.id);
        
        let not_found = profiles.iter().find(|p| p.id == "nonexistent");
        assert!(not_found.is_none());
    }

    #[test]
    fn test_profile_update_position() {
        let profile = SshProfile::default();
        let mut profiles = vec![profile.clone()];
        
        // Update the existing profile
        if let Some(pos) = profiles.iter().position(|p| p.id == profile.id) {
            profiles[pos] = profile.clone();
        } else {
            profiles.push(profile.clone());
        }
        
        // Should still be 1 since we updated, not added
        assert_eq!(profiles.len(), 1);
    }

    #[test]
    fn test_pathbuf_join() {
        let app_data_dir = PathBuf::from("/home/user/.config/cliqon");
        let profiles_path = app_data_dir.join("profiles.json");
        
        assert_eq!(profiles_path.to_string_lossy(), "/home/user/.config/cliqon/profiles.json");
    }

    #[test]
    fn test_path_exists_check() {
        let path = PathBuf::from("/tmp/nonexistent_file_12345.json");
        assert!(!path.exists());
    }

    #[test]
    fn test_option_handling() {
        let secret: Option<String> = None;
        let result = secret.clone();
        assert!(result.is_none());

        let secret2: Option<String> = Some("value".to_string());
        let result2 = secret2.clone();
        assert!(result2.is_some());
    }

    #[test]
    fn test_xor_operation() {
        let byte: u8 = 0x41; // 'A'
        let xored = byte ^ 0x6A;
        let restored = xored ^ 0x6A;
        assert_eq!(byte, restored);
    }

    #[test]
    fn test_hex_format() {
        let byte: u8 = 65; // 'A'
        let hex = format!("{:02x}", byte);
        assert_eq!(hex, "41");
        
        let byte2: u8 = 10;
        let hex2 = format!("{:02x}", byte2);
        assert_eq!(hex2, "0a"); // Leading zero
    }

    #[test]
    fn test_step_by_iterator() {
        let s = "abcdef";
        let pairs: Vec<&str> = (0..s.len()).step_by(2).map(|i| &s[i..i+2]).collect();
        assert_eq!(pairs, vec!["ab", "cd", "ef"]);
    }

    #[test]
    fn test_from_str_radix() {
        let result = u8::from_str_radix("41", 16);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 65);

        let invalid = u8::from_str_radix("ZZ", 16);
        assert!(invalid.is_err());
    }

    #[test]
    fn test_string_from_utf8() {
        let bytes = vec![65, 66, 67]; // 'A', 'B', 'C'
        let result = String::from_utf8(bytes);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "ABC");
    }

    #[test]
    fn test_result_and_option_combination() {
        let result: std::result::Result<Option<String>, &'static str> = Ok(Some("value".to_string()));
        assert!(result.is_ok());
        
        let result2: std::result::Result<Option<String>, &'static str> = Ok(None);
        assert!(result2.is_ok());
        assert!(result2.unwrap().is_none());
    }
}
