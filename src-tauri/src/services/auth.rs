use ssh2::Session;
use std::path::Path;

use crate::error::{AppError, Result};
use crate::models::profile::{AuthMethod, SshProfile};

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
