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
}

#[derive(Debug, Serialize, Deserialize)]
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

    let now = chrono::Utc::now().to_rfc3339();

    Ok(SshKey {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        key_type: key_type.to_string(),
        public_key,
        private_key_path: key_path.to_string_lossy().to_string(),
        created_at: now,
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

    let now = chrono::Utc::now().to_rfc3339();

    Ok(SshKey {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        key_type: "imported".to_string(),
        public_key,
        private_key_path: key_path.to_string_lossy().to_string(),
        created_at: now,
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

            let key_type = if name.contains("ed25519") {
                "ed25519"
            } else if name.contains("ecdsa") {
                "ecdsa"
            } else {
                "rsa"
            }.to_string();

            keys.push(SshKey {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                key_type,
                public_key,
                private_key_path: private_key_path.to_string_lossy().to_string(),
                created_at,
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
) -> Result<Vec<String>> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let output = exec_on_remote(&profile, secret.as_deref(), "cat ~/.ssh/authorized_keys 2>/dev/null || echo ''")?;
    
    let keys: Vec<String> = output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

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
