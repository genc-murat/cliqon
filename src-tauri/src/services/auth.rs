use ssh2::Session;
use std::path::Path;

use crate::error::{AppError, Result};
use crate::models::profile::{AuthMethod, SshProfile};

/// Authentication helper that handles SSH authentication using different methods.
/// 
/// This function supports three authentication methods:
/// - Password: Standard password authentication with keyboard-interactive fallback
/// - PrivateKey: Public key authentication using a key file
/// - Agent: SSH agent forwarding authentication
pub fn authenticate_session(
    session: &mut Session,
    profile: &SshProfile,
    secret: Option<&str>,
) -> Result<()> {
    match profile.auth_method {
        AuthMethod::Password => {
            let pwd = secret.unwrap_or_default();

            if let Err(e) = session.userauth_password(&profile.username, pwd) {
                // Try fallback to keyboard-interactive if password fails
                let mut fallback_success = false;
                let methods = session.auth_methods(&profile.username).unwrap_or_default();

                if methods.contains("keyboard-interactive") {
                    struct AutoPrompt<'a> {
                        pwd: &'a str,
                    }
                    impl<'a> ssh2::KeyboardInteractivePrompt for AutoPrompt<'a> {
                        fn prompt(
                            &mut self,
                            _name: &str,
                            _instructions: &str,
                            prompts: &[ssh2::Prompt],
                        ) -> Vec<String> {
                            let mut responses = Vec::new();
                            for _ in prompts {
                                responses.push(self.pwd.to_string());
                            }
                            responses
                        }
                    }

                    let mut prompt_handler = AutoPrompt { pwd };
                    let res = session
                        .userauth_keyboard_interactive(&profile.username, &mut prompt_handler);
                    if res.is_ok() {
                        fallback_success = true;
                    }
                }

                if !fallback_success {
                    return Err(e.into());
                }
            }
        }
        AuthMethod::PrivateKey => {
            let path = Path::new(profile.private_key_path.as_deref().unwrap_or(""));
            session.userauth_pubkey_file(&profile.username, None, path, secret)?;
        }
        AuthMethod::Agent => {
            session.userauth_agent(&profile.username)?;
        }
    }

    if !session.authenticated() {
        return Err(AppError::Custom("Authentication failed".to_string()));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_method_password_default() {
        let profile = SshProfile {
            id: "test-1".to_string(),
            name: "Test Profile".to_string(),
            host: "127.0.0.1".to_string(),
            port: 22,
            username: "testuser".to_string(),
            auth_method: AuthMethod::Password,
            category: None,
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: Some(false),
            color: None,
        };

        assert_eq!(profile.auth_method, AuthMethod::Password);
        assert_eq!(profile.username, "testuser");
    }

    #[test]
    fn test_auth_method_private_key() {
        let profile = SshProfile {
            id: "test-2".to_string(),
            name: "Key Profile".to_string(),
            host: "192.168.1.1".to_string(),
            port: 2222,
            username: "admin".to_string(),
            auth_method: AuthMethod::PrivateKey,
            category: Some("Servers".to_string()),
            private_key_path: Some("~/.ssh/id_rsa".to_string()),
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: Some(true),
            color: Some("#ff0000".to_string()),
        };

        assert_eq!(profile.auth_method, AuthMethod::PrivateKey);
        assert_eq!(profile.private_key_path, Some("~/.ssh/id_rsa".to_string()));
    }

    #[test]
    fn test_auth_method_agent() {
        let profile = SshProfile {
            id: "test-3".to_string(),
            name: "Agent Profile".to_string(),
            host: "example.com".to_string(),
            port: 22,
            username: "developer".to_string(),
            auth_method: AuthMethod::Agent,
            category: None,
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: None,
            color: None,
        };

        assert_eq!(profile.auth_method, AuthMethod::Agent);
        assert!(profile.private_key_path.is_none());
    }

    #[test]
    fn test_secret_none_default() {
        let secret: Option<&str> = None;
        let pwd = secret.unwrap_or_default();
        assert_eq!(pwd, "");
    }

    #[test]
    fn test_secret_some_value() {
        let secret: Option<&str> = Some("mypassword");
        let pwd = secret.unwrap_or_default();
        assert_eq!(pwd, "mypassword");
    }

    #[test]
    fn test_path_creation_from_str() {
        let path_str = "~/.ssh/id_rsa";
        let path = Path::new(path_str);
        assert_eq!(path.to_str(), Some("~/.ssh/id_rsa"));
    }

    #[test]
    fn test_path_creation_from_none() {
        let path_str: Option<&str> = None;
        let path = Path::new(path_str.unwrap_or(""));
        assert_eq!(path.to_str(), Some(""));
    }

    #[test]
    fn test_auth_method_equality() {
        assert_eq!(AuthMethod::Password, AuthMethod::Password);
        assert_eq!(AuthMethod::PrivateKey, AuthMethod::PrivateKey);
        assert_eq!(AuthMethod::Agent, AuthMethod::Agent);
        
        assert_ne!(AuthMethod::Password, AuthMethod::PrivateKey);
        assert_ne!(AuthMethod::Password, AuthMethod::Agent);
        assert_ne!(AuthMethod::PrivateKey, AuthMethod::Agent);
    }

    #[test]
    fn test_auth_method_debug() {
        let debug_str = format!("{:?}", AuthMethod::Password);
        assert_eq!(debug_str, "Password");
        
        let debug_str2 = format!("{:?}", AuthMethod::PrivateKey);
        assert_eq!(debug_str2, "PrivateKey");
    }

    #[test]
    fn test_profile_clone() {
        let original = SshProfile {
            id: "clone-test".to_string(),
            name: "Clone Test".to_string(),
            host: "127.0.0.1".to_string(),
            port: 22,
            username: "test".to_string(),
            auth_method: AuthMethod::Password,
            category: None,
            private_key_path: None,
            obfuscated_secret: None,
            tunnels: None,
            is_favorite: Some(false),
            color: None,
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.name, cloned.name);
        assert_eq!(original.auth_method, cloned.auth_method);
    }
}
