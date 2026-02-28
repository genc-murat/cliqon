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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cron_job_struct() {
        let job = CronJob {
            id: "cron-1".to_string(),
            schedule: "* * * * *".to_string(),
            command: "echo hello".to_string(),
            user: "root".to_string(),
            status: "active".to_string(),
        };

        assert_eq!(job.id, "cron-1");
        assert_eq!(job.schedule, "* * * * *");
    }

    #[test]
    fn test_cron_schedule_format() {
        let schedules = vec![
            "* * * * *",      // Every minute
            "0 * * * *",      // Every hour
            "0 0 * * *",      // Every day
            "0 0 * * 0",      // Every week
            "0 0 1 * *",      // Every month
        ];

        for schedule in schedules {
            let parts: Vec<&str> = schedule.split_whitespace().collect();
            assert_eq!(parts.len(), 5);
        }
    }

    #[test]
    fn test_cron_command_escaping() {
        let command = "echo 'hello world'";
        let escaped = command.replace("'", "'\\''");
        assert!(escaped.contains("'\\''"));
    }

    #[test]
    fn test_cron_line_format() {
        let schedule = "0 0 * * *";
        let command = "echo hello";
        let cron_line = format!("{} {}", schedule, command);
        
        assert!(cron_line.starts_with("0 0 * * *"));
        assert!(cron_line.contains("echo hello"));
    }

    #[test]
    fn test_crontab_add_command() {
        let cron_line = "0 0 * * * echo hello";
        let add_cron = format!(
            "(crontab -l 2>/dev/null; echo '{}') | crontab -",
            cron_line
        );
        
        assert!(add_cron.contains("crontab -l"));
        assert!(add_cron.contains("crontab -"));
    }

    #[test]
    fn test_crontab_remove_command() {
        let schedule = "0 0 * * *";
        let command = "echo hello";
        let remove_cron = format!(
            "crontab -l 2>/dev/null | grep -v '^{} {}' | crontab -",
            schedule, command
        );
        
        assert!(remove_cron.contains("grep -v"));
        assert!(remove_cron.contains("crontab -"));
    }

    #[test]
    fn test_cron_list_command() {
        let cmd = "crontab -l 2>/dev/null || echo ''";
        assert!(cmd.contains("crontab -l"));
    }

    #[test]
    fn test_cron_history_command() {
        let limit: u32 = 20;
        let cmd = format!("grep -r CRON /var/log/syslog 2>/dev/null | tail -{} || journalctl -u cron -n {} 2>/dev/null || echo 'No cron history available'", limit, limit);
        
        assert!(cmd.contains("grep -r CRON"));
        assert!(cmd.contains("tail -20"));
    }

    #[test]
    fn test_cron_limit_default() {
        let limit: Option<u32> = None;
        let limit_str = limit.unwrap_or(20);
        assert_eq!(limit_str, 20);
    }

    #[test]
    fn test_cron_limit_custom() {
        let limit: Option<u32> = Some(50);
        let limit_str = limit.unwrap_or(20);
        assert_eq!(limit_str, 50);
    }

    #[test]
    fn test_cron_line_parsing() {
        let line = "0 0 * * * echo hello world";
        let parts: Vec<&str> = line.splitn(6, ' ').collect();
        
        assert_eq!(parts.len(), 6);
        assert_eq!(parts[0], "0");
        assert_eq!(parts[5], "echo hello world");
    }

    #[test]
    fn test_cron_schedule_from_parts() {
        let parts = vec!["0", "0", "*", "*", "*"];
        let schedule = format!("{} {} {} {} {}", parts[0], parts[1], parts[2], parts[3], parts[4]);
        
        assert_eq!(schedule, "0 0 * * *");
    }

    #[test]
    fn test_cron_command_from_parts() {
        let parts = vec!["", "", "", "", "", "echo", "hello", "world"];
        let command = parts[5..].join(" ");
        
        assert_eq!(command, "echo hello world");
    }

    #[test]
    fn test_cron_comment_filter() {
        let lines = vec!["# This is a comment", "0 0 * * * echo hello", ""];
        let filtered: Vec<&str> = lines.into_iter()
            .filter(|l| !l.trim().is_empty() && !l.starts_with('#'))
            .collect();
        
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0], "0 0 * * * echo hello");
    }

    #[test]
    fn test_cron_empty_line_filter() {
        let lines = vec!["", "  ", "0 0 * * * echo hello"];
        let filtered: Vec<&str> = lines.into_iter()
            .filter(|l| !l.trim().is_empty())
            .collect();
        
        assert_eq!(filtered.len(), 1);
    }

    #[test]
    fn test_cron_job_status() {
        let status = "active";
        assert_eq!(status, "active");

        let status2 = "inactive";
        assert_eq!(status2, "inactive");
    }

    #[test]
    fn test_cron_user() {
        let users = vec!["root", "www-data", "mysql", "postgres"];
        
        for user in users {
            assert!(!user.is_empty());
        }
    }

    #[test]
    fn test_cron_result_types() {
        let _result_vec: Result<Vec<CronJob>> = Ok(Vec::new());
        let _result_bool: Result<bool> = Ok(true);
        let _result_strings: Result<Vec<String>> = Ok(Vec::new());
    }

    #[test]
    fn test_cron_uuid_generation() {
        let id = uuid::Uuid::new_v4().to_string();
        assert!(!id.is_empty());
        assert!(id.len() > 30);
    }

    #[test]
    fn test_cron_string_cloning() {
        let schedule = "0 0 * * *".to_string();
        let cloned = schedule.clone();
        
        assert_eq!(schedule, cloned);
    }

    #[test]
    fn test_cron_vec_operations() {
        let mut jobs: Vec<CronJob> = Vec::new();
        
        let job1 = CronJob {
            id: "j1".to_string(),
            schedule: "* * * * *".to_string(),
            command: "cmd1".to_string(),
            user: "root".to_string(),
            status: "active".to_string(),
        };
        
        jobs.push(job1);
        assert_eq!(jobs.len(), 1);
    }

    #[test]
    fn test_cron_lines_to_vec() {
        let output = "line1\nline2\nline3";
        let history: Vec<String> = output
            .lines()
            .filter(|l| !l.is_empty())
            .map(|s| s.to_string())
            .collect();
        
        assert_eq!(history.len(), 3);
    }

    #[test]
    fn test_cron_parts_len_check() {
        let line = "0 0 * * *";
        let parts: Vec<&str> = line.splitn(6, ' ').collect();
        let is_valid = parts.len() >= 6;
        
        assert!(!is_valid); // Only 5 parts, need 6
    }

    #[test]
    fn test_cron_valid_line() {
        let line = "0 0 * * * echo hello";
        let parts: Vec<&str> = line.splitn(6, ' ').collect();
        let is_valid = parts.len() >= 6;
        
        assert!(is_valid);
    }

    #[test]
    fn test_cron_clone_trait() {
        let job = CronJob {
            id: "j1".to_string(),
            schedule: "* * * * *".to_string(),
            command: "cmd".to_string(),
            user: "root".to_string(),
            status: "active".to_string(),
        };

        let cloned = job.clone();
        assert_eq!(job.id, cloned.id);
    }

    #[test]
    fn test_cron_serialize_deserialize() {
        let job = CronJob {
            id: "j1".to_string(),
            schedule: "0 0 * * *".to_string(),
            command: "echo test".to_string(),
            user: "root".to_string(),
            status: "active".to_string(),
        };

        let json = serde_json::to_string(&job).unwrap();
        let decoded: CronJob = serde_json::from_str(&json).unwrap();

        assert_eq!(job.id, decoded.id);
        assert_eq!(job.command, decoded.command);
    }

    #[test]
    fn test_cron_debug_format() {
        let job = CronJob {
            id: "j1".to_string(),
            schedule: "* * * * *".to_string(),
            command: "cmd".to_string(),
            user: "root".to_string(),
            status: "active".to_string(),
        };

        let debug_str = format!("{:?}", job);
        assert!(debug_str.contains("CronJob"));
        assert!(debug_str.contains("j1"));
    }
}
