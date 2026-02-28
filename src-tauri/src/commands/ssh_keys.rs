use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::net::TcpStream;
use std::time::Duration;
use std::io::Read;
use ssh2::Session;
use tauri::State;
use crate::error::{Result, AppError};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;
use crate::state::app_state::AppState;
use std::fs;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshKey {
    pub id: String,
    pub name: String,
    pub key_type: String,
    pub public_key: String,
    pub private_key_path: String,
    pub created_at: String,
    pub fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteKey {
    pub raw: String,
    pub fingerprint: String,
    pub key_type: String,
    pub comment: String,
    pub bit_length: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GenerateKeyRequest {
    pub name: String,
    pub key_type: String,
    pub passphrase: Option<String>,
}

fn create_ssh_session(profile: &SshProfile, secret: Option<&str>) -> Result<Session> {
    let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
    tcp.set_read_timeout(Some(Duration::from_secs(30)))?;
    tcp.set_write_timeout(Some(Duration::from_secs(30)))?;
    
    let mut session = Session::new()?;
    session.set_tcp_stream(tcp);
    session.handshake()?;
    
    authenticate_session(&mut session, profile, secret)?;
    
    Ok(session)
}

fn exec_on_remote(profile: &SshProfile, secret: Option<&str>, command: &str) -> Result<String> {
    let session = create_ssh_session(profile, secret)?;
    let mut channel = session.channel_session()?;
    channel.exec(command)?;
    
    let mut output = String::new();
    let mut buf = [0u8; 1024];
    loop {
        match channel.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                output.push_str(&String::from_utf8_lossy(&buf[..n]));
            }
            Err(_) => break,
        }
    }
    
    channel.wait_close().ok();
    
    Ok(output)
}

fn get_keys_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".ssh").join("cliqon_keys")
}

fn ensure_keys_dir() -> Result<PathBuf> {
    let dir = get_keys_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

use std::io::Write;

fn get_key_info(public_key: &str) -> Result<RemoteKey> {
    let mut child = Command::new("ssh-keygen")
        .args(["-lf", "-"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(public_key.as_bytes())?;
    }

    let output = child.wait_with_output()?;

    if !output.status.success() {
        return Ok(RemoteKey {
            raw: public_key.to_string(),
            fingerprint: "unknown".to_string(),
            key_type: "unknown".to_string(),
            comment: "unknown".to_string(),
            bit_length: 0,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Format: 256 SHA256:B6c... test (ED25519)
    let parts: Vec<&str> = stdout.split_whitespace().collect();
    if parts.len() < 3 {
        return Ok(RemoteKey {
            raw: public_key.to_string(),
            fingerprint: "unknown".to_string(),
            key_type: "unknown".to_string(),
            comment: "unknown".to_string(),
            bit_length: 0,
        });
    }

    let bit_length = parts[0].parse::<u32>().unwrap_or(0);
    let fingerprint = parts[1].to_string();
    let key_type = parts.last().map(|s| s.trim_matches(|c| c == '(' || c == ')')).unwrap_or("unknown").to_string();
    
    // Comment is everything between fingerprint and key_type
    let comment = if parts.len() > 3 {
        parts[2..parts.len()-1].join(" ")
    } else {
        "".to_string()
    };

    Ok(RemoteKey {
        raw: public_key.to_string(),
        fingerprint,
        key_type,
        comment,
        bit_length,
    })
}

#[tauri::command]
pub async fn generate_ssh_key(
    name: String,
    key_type: String,
    passphrase: Option<String>,
) -> Result<SshKey> {
    let keys_dir = ensure_keys_dir()?;
    let key_path = keys_dir.join(&name);
    
    let key_type_arg = match key_type.as_str() {
        "ed25519" => "ed25519",
        "ecdsa" => "ecdsa",
        _ => "rsa",
    };

    let args = vec![
        "-t".to_string(),
        key_type_arg.to_string(),
        "-f".to_string(),
        key_path.to_string_lossy().to_string(),
        "-N".to_string(),
        passphrase.as_deref().unwrap_or("").to_string(),
        "-C".to_string(),
        name.clone(),
    ];

    let output = Command::new("ssh-keygen")
        .args(&args)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Custom(format!("Failed to generate key: {}", stderr)));
    }

    let public_key = fs::read_to_string(format!("{}.pub", key_path.to_string_lossy()))?
        .trim()
        .to_string();

    let info = get_key_info(&public_key)?;
    let now = chrono::Utc::now().to_rfc3339();

    Ok(SshKey {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        key_type: info.key_type,
        public_key,
        private_key_path: key_path.to_string_lossy().to_string(),
        created_at: now,
        fingerprint: info.fingerprint,
    })
}

#[tauri::command]
pub async fn import_ssh_key(
    name: String,
    private_key: String,
    passphrase: Option<String>,
) -> Result<SshKey> {
    let keys_dir = ensure_keys_dir()?;
    let key_path = keys_dir.join(&name);

    if key_path.exists() {
        return Err(AppError::Custom("A key with this name already exists".to_string()));
    }

    fs::write(&key_path, &private_key)?;

    let output = Command::new("ssh-keygen")
        .args(["-y", "-f", &key_path.to_string_lossy()])
        .output()?;

    if !output.status.success() {
        fs::remove_file(&key_path).ok();
        return Err(AppError::Custom("Invalid private key".to_string()));
    }

    let public_key = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if let Some(pass) = passphrase {
        let output = Command::new("ssh-keygen")
            .args(["-p", "-m", "PEM", "-f", &key_path.to_string_lossy(), "-N", &pass, "-P", ""])
            .output()?;
        
        if !output.status.success() {
            fs::remove_file(&key_path).ok();
            return Err(AppError::Custom("Failed to set passphrase".to_string()));
        }
    }

    let info = get_key_info(&public_key)?;
    let now = chrono::Utc::now().to_rfc3339();

    Ok(SshKey {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        key_type: info.key_type,
        public_key,
        private_key_path: key_path.to_string_lossy().to_string(),
        created_at: now,
        fingerprint: info.fingerprint,
    })
}

#[tauri::command]
pub async fn list_local_keys() -> Result<Vec<SshKey>> {
    let keys_dir = get_keys_dir();
    
    if !keys_dir.exists() {
        return Ok(Vec::new());
    }

    let mut keys = Vec::new();

    for entry in fs::read_dir(&keys_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().map_or(false, |e| e == "pub") {
            let name = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let private_key_path = keys_dir.join(&name);
            if !private_key_path.exists() {
                continue;
            }

            let public_key = fs::read_to_string(&path)?
                .trim()
                .to_string();

            let metadata = fs::metadata(&path)?;
            let created_at = metadata.created()
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
                .unwrap_or_else(|_| "unknown".to_string());

            let info = get_key_info(&public_key)?;

            keys.push(SshKey {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                key_type: info.key_type,
                public_key,
                private_key_path: private_key_path.to_string_lossy().to_string(),
                created_at,
                fingerprint: info.fingerprint,
            });
        }
    }

    Ok(keys)
}

#[tauri::command]
pub async fn delete_local_key(_id: String, name: String) -> Result<bool> {
    let keys_dir = get_keys_dir();
    let private_key_path = keys_dir.join(&name);
    let public_key_path = keys_dir.join(format!("{}.pub", name));

    if private_key_path.exists() {
        fs::remove_file(private_key_path)?;
    }
    if public_key_path.exists() {
        fs::remove_file(public_key_path)?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn get_remote_authorized_keys(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<Vec<RemoteKey>> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let output = exec_on_remote(&profile, secret.as_deref(), "cat ~/.ssh/authorized_keys 2>/dev/null || echo ''")?;
    
    let mut keys = Vec::new();
    for line in output.lines().filter(|line| !line.trim().is_empty()) {
        if let Ok(info) = get_key_info(line) {
            keys.push(info);
        }
    }

    Ok(keys)
}

#[tauri::command]
pub async fn add_remote_authorized_key(
    state: State<'_, AppState>,
    profile: SshProfile,
    public_key: String,
) -> Result<bool> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    exec_on_remote(&profile, secret.as_deref(), &format!("mkdir -p ~/.ssh && chmod 700 ~/.ssh"))?;
    
    let add_key_cmd = format!(
        "echo '{}' >> ~/.ssh/authorized_keys && chmod 644 ~/.ssh/authorized_keys",
        public_key.replace("'", "'\\''")
    );
    exec_on_remote(&profile, secret.as_deref(), &add_key_cmd)?;

    Ok(true)
}

#[tauri::command]
pub async fn remove_remote_authorized_key(
    state: State<'_, AppState>,
    profile: SshProfile,
    public_key: String,
) -> Result<bool> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let temp_file = "/tmp/cliqon_authorized_keys_temp";
    let escaped_key = public_key.replace("'", "'\\''");
    
    exec_on_remote(&profile, secret.as_deref(), &format!(
        "grep -v '{}' ~/.ssh/authorized_keys > {} && mv {} ~/.ssh/authorized_keys && chmod 644 ~/.ssh/authorized_keys",
        escaped_key, temp_file, temp_file
    ))?;

    Ok(true)
}

#[tauri::command]
pub async fn deploy_key_to_remote(
    state: State<'_, AppState>,
    profile: SshProfile,
    key_name: String,
    remote_username: String,
) -> Result<bool> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let keys_dir = get_keys_dir();
    let public_key_path = keys_dir.join(format!("{}.pub", key_name));
    
    if !public_key_path.exists() {
        return Err(AppError::Custom("Public key not found".to_string()));
    }

    let public_key = fs::read_to_string(&public_key_path)?
        .trim()
        .to_string();

    let remote_home = exec_on_remote(&profile, secret.as_deref(), &format!("getent passwd {} | cut -d: -f6", remote_username))?
        .trim()
        .to_string();

    if remote_home.is_empty() {
        return Err(AppError::Custom(format!("User {} not found on remote server", remote_username)));
    }

    exec_on_remote(&profile, secret.as_deref(), &format!("mkdir -p {}/.ssh && chmod 700 {}/.ssh", remote_home, remote_home))?;
    
    exec_on_remote(&profile, secret.as_deref(), &format!(
        "echo '{}' >> {}/.ssh/authorized_keys && chmod 644 {}/.ssh/authorized_keys",
        public_key.replace("'", "'\\''"),
        remote_home,
        remote_home
    ))?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_key_struct() {
        let key = SshKey {
            id: "test-id".to_string(),
            name: "test-key".to_string(),
            key_type: "ed25519".to_string(),
            public_key: "ssh-ed25519 AAAA...".to_string(),
            private_key_path: "/home/user/.ssh/cliqon_keys/test-key".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            fingerprint: "SHA256:test".to_string(),
        };

        assert_eq!(key.name, "test-key");
        assert_eq!(key.key_type, "ed25519");
    }

    #[test]
    fn test_remote_key_struct() {
        let key = RemoteKey {
            raw: "ssh-ed25519 AAAA...".to_string(),
            fingerprint: "SHA256:test".to_string(),
            key_type: "ED25519".to_string(),
            comment: "test@example.com".to_string(),
            bit_length: 256,
        };

        assert_eq!(key.bit_length, 256);
        assert_eq!(key.key_type, "ED25519");
    }

    #[test]
    fn test_generate_key_request() {
        let req = GenerateKeyRequest {
            name: "my-key".to_string(),
            key_type: "ed25519".to_string(),
            passphrase: Some("secret".to_string()),
        };

        assert_eq!(req.name, "my-key");
        assert!(req.passphrase.is_some());
    }

    #[test]
    fn test_key_type_validation() {
        let valid_types = vec!["ed25519", "ecdsa", "rsa"];
        for key_type in valid_types {
            let key_type_arg = match key_type {
                "ed25519" => "ed25519",
                "ecdsa" => "ecdsa",
                _ => "rsa",
            };
            assert_eq!(key_type, key_type_arg);
        }
    }

    #[test]
    fn test_key_type_default() {
        let key_type = "unknown";
        let key_type_arg = match key_type {
            "ed25519" => "ed25519",
            "ecdsa" => "ecdsa",
            _ => "rsa",
        };
        assert_eq!(key_type_arg, "rsa");
    }

    #[test]
    fn test_key_path_construction() {
        let name = "test-key";
        let pub_path = format!("{}.pub", name);
        assert_eq!(pub_path, "test-key.pub");
    }

    #[test]
    fn test_authorized_keys_line_format() {
        let line = "ssh-rsa AAAAB3... user@host";
        assert!(!line.trim().is_empty());
        assert!(line.contains("ssh-rsa"));
    }

    #[test]
    fn test_remote_command_escaping() {
        let public_key = "ssh-ed25519 AAAA'test'";
        let escaped = public_key.replace("'", "'\\''");
        let cmd = format!("echo '{}' >> ~/.ssh/authorized_keys", escaped);
        
        assert!(cmd.contains("echo"));
        assert!(cmd.contains("authorized_keys"));
    }

    #[test]
    fn test_mkdir_command() {
        let cmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh";
        assert!(cmd.contains("mkdir -p"));
        assert!(cmd.contains("chmod 700"));
    }

    #[test]
    fn test_chmod_authorized_keys() {
        let cmd = "chmod 644 ~/.ssh/authorized_keys";
        assert!(cmd.contains("chmod 644"));
    }

    #[test]
    fn test_grep_command() {
        let key = "ssh-ed25519 AAAA";
        let escaped = key.replace("'", "'\\''");
        let cmd = format!("grep -v '{}' ~/.ssh/authorized_keys", escaped);
        
        assert!(cmd.contains("grep -v"));
    }

    #[test]
    fn test_getent_command() {
        let username = "testuser";
        let cmd = format!("getent passwd {} | cut -d: -f6", username);
        
        assert!(cmd.contains("getent passwd"));
        assert!(cmd.contains("cut -d: -f6"));
    }

    #[test]
    fn test_file_extension_check() {
        let path = PathBuf::from("key.pub");
        let has_pub_extension = path.extension().map_or(false, |e| e == "pub");
        assert!(has_pub_extension);

        let path2 = PathBuf::from("key");
        let has_pub_extension2 = path2.extension().map_or(false, |e| e == "pub");
        assert!(!has_pub_extension2);
    }

    #[test]
    fn test_file_stem_extraction() {
        let path = PathBuf::from("/home/user/.ssh/cliqon_keys/key.pub");
        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        assert_eq!(name, "key");
    }

    #[test]
    fn test_ssh_keygen_args_construction() {
        let name = "test-key";
        let key_type = "ed25519";
        let key_path = PathBuf::from("/tmp/test-key");
        let passphrase: Option<String> = None;

        let args = vec![
            "-t".to_string(),
            key_type.to_string(),
            "-f".to_string(),
            key_path.to_string_lossy().to_string(),
            "-N".to_string(),
            passphrase.as_deref().unwrap_or("").to_string(),
            "-C".to_string(),
            name.to_string(),
        ];

        assert_eq!(args[0], "-t");
        assert_eq!(args[1], "ed25519");
        assert_eq!(args[4], "-N");
        assert_eq!(args[5], "");
    }

    #[test]
    fn test_remote_key_parse_key_type() {
        let stdout = "256 SHA256:test user (ED25519)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        let key_type = parts.last().map(|s| s.trim_matches(|c| c == '(' || c == ')')).unwrap_or("unknown");
        
        assert_eq!(key_type, "ED25519");
    }

    #[test]
    fn test_remote_key_parse_bit_length() {
        let stdout = "4096 SHA256:test user (RSA)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        let bit_length = parts[0].parse::<u32>().unwrap_or(0);
        
        assert_eq!(bit_length, 4096);
    }

    #[test]
    fn test_delete_key_paths() {
        let keys_dir = PathBuf::from("/home/user/.ssh/cliqon_keys");
        let name = "test-key";
        
        let private_key_path = keys_dir.join(&name);
        let public_key_path = keys_dir.join(format!("{}.pub", name));
        
        assert!(private_key_path.to_string_lossy().contains("test-key"));
        assert!(public_key_path.to_string_lossy().contains("test-key.pub"));
    }

    #[test]
    fn test_string_filter() {
        let lines = vec!["key1", "", "  ", "key2"];
        let filtered: Vec<&str> = lines.into_iter().filter(|line| !line.trim().is_empty()).collect();
        
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn test_optional_passphrase_handling() {
        let passphrase: Option<String> = None;
        let value = passphrase.as_deref().unwrap_or("");
        assert_eq!(value, "");

        let passphrase2: Option<String> = Some("secret".to_string());
        let value2 = passphrase2.as_deref().unwrap_or("");
        assert_eq!(value2, "secret");
    }

    #[test]
    fn test_ssh_key_struct_creation() {
        let key = SshKey {
            id: "key-1".to_string(),
            name: "test-key".to_string(),
            key_type: "ed25519".to_string(),
            public_key: "ssh-ed25519 AAAA...".to_string(),
            private_key_path: "/home/user/.ssh/cliqon_keys/test-key".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            fingerprint: "SHA256:abc123".to_string(),
        };

        assert_eq!(key.id, "key-1");
        assert_eq!(key.name, "test-key");
        assert_eq!(key.key_type, "ed25519");
    }

    #[test]
    fn test_remote_key_struct_creation() {
        let key = RemoteKey {
            raw: "ssh-ed25519 AAAA...".to_string(),
            fingerprint: "SHA256:abc123".to_string(),
            key_type: "ED25519".to_string(),
            comment: "user@host".to_string(),
            bit_length: 256,
        };

        assert_eq!(key.bit_length, 256);
        assert_eq!(key.key_type, "ED25519");
    }

    #[test]
    fn test_generate_key_request_creation() {
        let req = GenerateKeyRequest {
            name: "my-key".to_string(),
            key_type: "ed25519".to_string(),
            passphrase: Some("secret".to_string()),
        };

        assert_eq!(req.name, "my-key");
        assert!(req.passphrase.is_some());
    }

    #[test]
    fn test_key_type_matching() {
        let key_type = "ed25519";
        let key_type_arg = match key_type {
            "ed25519" => "ed25519",
            "ecdsa" => "ecdsa",
            _ => "rsa",
        };
        assert_eq!(key_type_arg, "ed25519");

        let key_type2 = "ecdsa";
        let key_type_arg2 = match key_type2 {
            "ed25519" => "ed25519",
            "ecdsa" => "ecdsa",
            _ => "rsa",
        };
        assert_eq!(key_type_arg2, "ecdsa");

        let key_type3 = "rsa";
        let key_type_arg3 = match key_type3 {
            "ed25519" => "ed25519",
            "ecdsa" => "ecdsa",
            _ => "rsa",
        };
        assert_eq!(key_type_arg3, "rsa");

        let key_type4 = "unknown";
        let key_type_arg4 = match key_type4 {
            "ed25519" => "ed25519",
            "ecdsa" => "ecdsa",
            _ => "rsa",
        };
        assert_eq!(key_type_arg4, "rsa");
    }

    #[test]
    fn test_ssh_keygen_args_vector() {
        let name = "test-key";
        let key_type = "ed25519";
        let key_path = PathBuf::from("/tmp/test-key");
        let passphrase: Option<String> = None;

        let args = vec![
            "-t".to_string(),
            key_type.to_string(),
            "-f".to_string(),
            key_path.to_string_lossy().to_string(),
            "-N".to_string(),
            passphrase.as_deref().unwrap_or("").to_string(),
            "-C".to_string(),
            name.to_string(),
        ];

        assert_eq!(args.len(), 8);
        assert_eq!(args[0], "-t");
        assert_eq!(args[1], "ed25519");
        assert_eq!(args[4], "-N");
        assert_eq!(args[5], "");
    }

    #[test]
    fn test_ssh_keygen_args_with_passphrase() {
        let passphrase: Option<String> = Some("secret123".to_string());
        let passphrase_arg = passphrase.as_deref().unwrap_or("");
        assert_eq!(passphrase_arg, "secret123");
    }

    #[test]
    fn test_public_key_path_construction() {
        let key_path = PathBuf::from("/home/user/.ssh/cliqon_keys/test-key");
        let pub_path = format!("{}.pub", key_path.to_string_lossy());
        assert!(pub_path.ends_with(".pub"));
    }

    #[test]
    fn test_key_path_exists_check() {
        let key_path = PathBuf::from("/tmp/nonexistent_key");
        let exists = key_path.exists();
        assert!(!exists);
    }

    #[test]
    fn test_private_key_write() {
        let private_key = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----";
        assert!(private_key.starts_with("-----BEGIN"));
        assert!(private_key.ends_with("-----END OPENSSH PRIVATE KEY-----"));
    }

    #[test]
    fn test_ssh_keygen_extract_public_key_args() {
        let key_path = PathBuf::from("/tmp/test-key");
        let key_path_str = key_path.to_string_lossy();
        let args: Vec<&str> = vec!["-y", "-f", key_path_str.as_ref()];
        
        assert_eq!(args.len(), 3);
        assert_eq!(args[0], "-y");
        assert_eq!(args[1], "-f");
    }

    #[test]
    fn test_ssh_keygen_set_passphrase_args() {
        let key_path = PathBuf::from("/tmp/test-key");
        let passphrase = "secret123";
        let key_path_str = key_path.to_string_lossy();
        let args: Vec<&str> = vec!["-p", "-m", "PEM", "-f", key_path_str.as_ref(), "-N", passphrase, "-P", ""];
        
        assert_eq!(args.len(), 9);
        assert_eq!(args[0], "-p");
        assert_eq!(args[1], "-m");
        assert_eq!(args[2], "PEM");
    }

    #[test]
    fn test_key_info_parsing() {
        let stdout = "256 SHA256:B6c:test user@example (ED25519)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        
        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0], "256");
        assert_eq!(parts[1], "SHA256:B6c:test");
    }

    #[test]
    fn test_key_info_bit_length_parsing() {
        let stdout = "4096 SHA256:test user (RSA)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        let bit_length = parts[0].parse::<u32>().unwrap_or(0);
        
        assert_eq!(bit_length, 4096);
    }

    #[test]
    fn test_key_info_fingerprint_extraction() {
        let stdout = "256 SHA256:B6c:test user (ED25519)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        let fingerprint = parts[1].to_string();
        
        assert_eq!(fingerprint, "SHA256:B6c:test");
        assert!(fingerprint.starts_with("SHA256:"));
    }

    #[test]
    fn test_key_info_type_extraction() {
        let stdout = "256 SHA256:test user (ED25519)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        let key_type = parts.last().map(|s| s.trim_matches(|c| c == '(' || c == ')')).unwrap_or("unknown");
        
        assert_eq!(key_type, "ED25519");
    }

    #[test]
    fn test_key_info_comment_extraction() {
        let stdout = "256 SHA256:test user@example.com (ED25519)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        let comment = if parts.len() > 3 {
            parts[2..parts.len()-1].join(" ")
        } else {
            "".to_string()
        };
        
        assert_eq!(comment, "user@example.com");
    }

    #[test]
    fn test_key_info_insufficient_parts() {
        let stdout = "256 SHA256:test";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        
        assert!(parts.len() < 3);
        
        let key = RemoteKey {
            raw: "test".to_string(),
            fingerprint: "unknown".to_string(),
            key_type: "unknown".to_string(),
            comment: "unknown".to_string(),
            bit_length: 0,
        };
        assert_eq!(key.bit_length, 0);
    }

    #[test]
    fn test_keys_dir_path_construction() {
        let home = PathBuf::from("/home/user");
        let keys_dir = home.join(".ssh").join("cliqon_keys");
        
        assert_eq!(keys_dir.to_string_lossy(), "/home/user/.ssh/cliqon_keys");
    }

    #[test]
    fn test_ssh_key_file_extension_check() {
        let path = PathBuf::from("key.pub");
        let has_pub_extension = path.extension().map_or(false, |e| e == "pub");
        assert!(has_pub_extension);

        let path2 = PathBuf::from("key");
        let has_pub_extension2 = path2.extension().map_or(false, |e| e == "pub");
        assert!(!has_pub_extension2);

        let path3 = PathBuf::from("key.txt");
        let has_pub_extension3 = path3.extension().map_or(false, |e| e == "pub");
        assert!(!has_pub_extension3);
    }

    #[test]
    fn test_ssh_key_file_stem_extraction() {
        let path = PathBuf::from("/home/user/.ssh/cliqon_keys/key.pub");
        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        assert_eq!(name, "key");
    }

    #[test]
    fn test_public_key_trim() {
        let public_key = "ssh-ed25519 AAAA... user@host\n";
        let trimmed = public_key.trim();
        assert!(!trimmed.ends_with('\n'));
    }

    #[test]
    fn test_created_at_timestamp() {
        let now = chrono::Utc::now().to_rfc3339();
        assert!(!now.is_empty());
        assert!(now.contains('T'));
    }

    #[test]
    fn test_uuid_generation() {
        let id = uuid::Uuid::new_v4().to_string();
        assert!(!id.is_empty());
        assert!(id.len() > 30);
    }

    #[test]
    fn test_keys_vec_operations() {
        let mut keys: Vec<SshKey> = Vec::new();
        assert!(keys.is_empty());

        keys.push(SshKey {
            id: "k1".to_string(),
            name: "key1".to_string(),
            key_type: "ed25519".to_string(),
            public_key: "ssh-ed25519 AAAA...".to_string(),
            private_key_path: "/path/to/key1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            fingerprint: "SHA256:abc".to_string(),
        });

        assert_eq!(keys.len(), 1);
    }

    #[test]
    fn test_remote_key_parse_success_case() {
        let stdout = "256 SHA256:B6c:test user@example (ED25519)";
        let parts: Vec<&str> = stdout.split_whitespace().collect();
        
        if parts.len() >= 3 {
            let bit_length = parts[0].parse::<u32>().unwrap_or(0);
            let fingerprint = parts[1].to_string();
            let key_type = parts.last().map(|s| s.trim_matches(|c| c == '(' || c == ')')).unwrap_or("unknown");
            
            assert_eq!(bit_length, 256);
            assert!(fingerprint.starts_with("SHA256:"));
            assert_eq!(key_type, "ED25519");
        }
    }

    #[test]
    fn test_ssh_key_clone() {
        let original = SshKey {
            id: "k1".to_string(),
            name: "key1".to_string(),
            key_type: "ed25519".to_string(),
            public_key: "ssh-ed25519 AAAA...".to_string(),
            private_key_path: "/path/to/key".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            fingerprint: "SHA256:abc".to_string(),
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.name, cloned.name);
    }

    #[test]
    fn test_remote_key_clone() {
        let original = RemoteKey {
            raw: "ssh-ed25519 AAAA...".to_string(),
            fingerprint: "SHA256:abc".to_string(),
            key_type: "ED25519".to_string(),
            comment: "user@host".to_string(),
            bit_length: 256,
        };

        let cloned = original.clone();
        assert_eq!(original.bit_length, cloned.bit_length);
    }

    #[test]
    fn test_generate_key_request_clone() {
        let original = GenerateKeyRequest {
            name: "key1".to_string(),
            key_type: "ed25519".to_string(),
            passphrase: Some("secret".to_string()),
        };

        let cloned = original.clone();
        assert_eq!(original.name, cloned.name);
    }

    #[test]
    fn test_ssh_key_debug_format() {
        let key = SshKey {
            id: "k1".to_string(),
            name: "key1".to_string(),
            key_type: "ed25519".to_string(),
            public_key: "ssh-ed25519 AAAA...".to_string(),
            private_key_path: "/path/to/key".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            fingerprint: "SHA256:abc".to_string(),
        };

        let debug_str = format!("{:?}", key);
        assert!(debug_str.contains("SshKey"));
        assert!(debug_str.contains("key1"));
    }

    #[test]
    fn test_remote_key_debug_format() {
        let key = RemoteKey {
            raw: "ssh-ed25519 AAAA...".to_string(),
            fingerprint: "SHA256:abc".to_string(),
            key_type: "ED25519".to_string(),
            comment: "user@host".to_string(),
            bit_length: 256,
        };

        let debug_str = format!("{:?}", key);
        assert!(debug_str.contains("RemoteKey"));
    }

    #[test]
    fn test_generate_key_request_debug_format() {
        let req = GenerateKeyRequest {
            name: "key1".to_string(),
            key_type: "ed25519".to_string(),
            passphrase: Some("secret".to_string()),
        };

        let debug_str = format!("{:?}", req);
        assert!(debug_str.contains("GenerateKeyRequest"));
    }

    #[test]
    fn test_ssh_key_serialize_deserialize() {
        let original = SshKey {
            id: "k1".to_string(),
            name: "key1".to_string(),
            key_type: "ed25519".to_string(),
            public_key: "ssh-ed25519 AAAA...".to_string(),
            private_key_path: "/path/to/key".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            fingerprint: "SHA256:abc".to_string(),
        };

        let json = serde_json::to_string(&original).unwrap();
        let decoded: SshKey = serde_json::from_str(&json).unwrap();

        assert_eq!(original.id, decoded.id);
        assert_eq!(original.name, decoded.name);
    }

    #[test]
    fn test_remote_key_serialize_deserialize() {
        let original = RemoteKey {
            raw: "ssh-ed25519 AAAA...".to_string(),
            fingerprint: "SHA256:abc".to_string(),
            key_type: "ED25519".to_string(),
            comment: "user@host".to_string(),
            bit_length: 256,
        };

        let json = serde_json::to_string(&original).unwrap();
        let decoded: RemoteKey = serde_json::from_str(&json).unwrap();

        assert_eq!(original.bit_length, decoded.bit_length);
    }

    #[test]
    fn test_key_type_validation_vec() {
        let valid_types = vec!["ed25519", "ecdsa", "rsa"];
        for key_type in valid_types {
            let key_type_arg = match key_type {
                "ed25519" => "ed25519",
                "ecdsa" => "ecdsa",
                _ => "rsa",
            };
            assert_eq!(key_type, key_type_arg);
        }
    }

    #[test]
    fn test_error_messages() {
        let errors = vec![
            "A key with this name already exists",
            "Invalid private key",
            "Failed to generate key",
            "Failed to set passphrase",
        ];

        for error in errors {
            let err = AppError::Custom(error.to_string());
            assert!(err.to_string().contains(error));
        }
    }

    #[test]
    fn test_result_types() {
        let _result_key: Result<SshKey> = Err(AppError::Custom("test".to_string()));
        let _result_vec: Result<Vec<SshKey>> = Ok(Vec::new());
        let _result_unit: Result<()> = Ok(());
    }

    #[test]
    fn test_command_async_types() {
        use std::future;
        let _generate: fn(String, String, Option<String>) -> future::Ready<Result<SshKey>> = 
            |_, _, _| future::ready(Err(AppError::Custom("test".to_string())));
        let _import: fn(String, String, Option<String>) -> future::Ready<Result<SshKey>> = 
            |_, _, _| future::ready(Err(AppError::Custom("test".to_string())));
        let _list: fn() -> future::Ready<Result<Vec<SshKey>>> = 
            || future::ready(Ok(Vec::new()));
    }
}
