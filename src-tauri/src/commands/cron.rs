use serde::{Deserialize, Serialize};
use std::io::Read;
use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CronJob {
    pub id: String,
    pub schedule: String,
    pub command: String,
    pub user: String,
    pub status: String,
}

fn exec_on_remote_cron(profile: &SshProfile, secret: Option<&str>, command: &str) -> Result<String> {
    use std::net::TcpStream;
    use std::time::Duration;
    use ssh2::Session;
    use crate::services::auth::authenticate_session;

    let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
    tcp.set_read_timeout(Some(Duration::from_secs(30)))?;
    tcp.set_write_timeout(Some(Duration::from_secs(30)))?;
    
    let mut session = Session::new()?;
    session.set_tcp_stream(tcp);
    session.handshake()?;
    
    authenticate_session(&mut session, profile, secret)?;
    
    let mut channel = session.channel_session()?;
    channel.exec(command)?;
    
    let mut output = String::new();
    let mut buf = [0u8; 4096];
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

#[tauri::command]
pub async fn list_cron_jobs(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<Vec<CronJob>> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let output = exec_on_remote_cron(&profile, secret.as_deref(), "crontab -l 2>/dev/null || echo ''")?;

    let mut jobs = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = line.splitn(6, ' ').collect();
        if parts.len() < 6 {
            continue;
        }

        let schedule = format!("{} {} {} {} {}", parts[0], parts[1], parts[2], parts[3], parts[4]);
        let command = parts[5..].join(" ");

        jobs.push(CronJob {
            id: uuid::Uuid::new_v4().to_string(),
            schedule,
            command,
            user: profile.username.clone(),
            status: "active".to_string(),
        });
    }

    Ok(jobs)
}

#[tauri::command]
pub async fn create_cron_job(
    state: State<'_, AppState>,
    profile: SshProfile,
    schedule: String,
    command: String,
) -> Result<bool> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let escaped_command = command.replace("'", "'\\''");
    let cron_line = format!("{} {}", schedule, escaped_command);
    
    let add_cron = format!(
        "(crontab -l 2>/dev/null; echo '{}') | crontab -",
        cron_line
    );

    exec_on_remote_cron(&profile, secret.as_deref(), &add_cron)?;

    Ok(true)
}

#[tauri::command]
pub async fn delete_cron_job(
    state: State<'_, AppState>,
    profile: SshProfile,
    schedule: String,
    command: String,
) -> Result<bool> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let escaped_schedule = schedule.replace("'", "'\\''");
    let escaped_command = command.replace("'", "'\\''");
    
    let remove_cron = format!(
        "crontab -l 2>/dev/null | grep -v '^{} {}' | crontab -",
        escaped_schedule, escaped_command
    );

    exec_on_remote_cron(&profile, secret.as_deref(), &remove_cron)?;

    Ok(true)
}

#[tauri::command]
pub async fn get_cron_history(
    state: State<'_, AppState>,
    profile: SshProfile,
    limit: Option<u32>,
) -> Result<Vec<String>> {
    let store = state.profile_store.lock().unwrap();
    let secret = store.get_profile_secret(&profile.id)?;

    let limit_str = limit.unwrap_or(20);
    
    let output = exec_on_remote_cron(
        &profile, 
        secret.as_deref(), 
        &format!("grep -r CRON /var/log/syslog 2>/dev/null | tail -{} || journalctl -u cron -n {} 2>/dev/null || echo 'No cron history available'", limit_str, limit_str)
    )?;

    let history: Vec<String> = output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|s| s.to_string())
        .collect();

    Ok(history)
}
