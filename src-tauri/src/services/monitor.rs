use std::collections::HashMap;
use std::io::Read;
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use ssh2::Session;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

#[derive(Debug, Clone, Serialize)]
pub struct ServerMetrics {
    pub cpu_percent: f64,
    pub ram_total: u64,
    pub ram_used: u64,
    pub ram_percent: f64,
    pub disk_total: u64,
    pub disk_used: u64,
    pub disk_percent: f64,
    pub load_1: f64,
    pub load_5: f64,
    pub load_15: f64,
    pub uptime: String,
    pub hostname: String,
    pub os_info: String,
}

struct MonitorThread {
    stop_flag: Arc<Mutex<bool>>,
}

pub struct MonitorManager {
    monitors: Arc<Mutex<HashMap<String, MonitorThread>>>,
}

impl MonitorManager {
    pub fn new() -> Self {
        Self {
            monitors: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start(
        &self,
        app: AppHandle,
        profile: SshProfile,
        secret: Option<String>,
        session_id: String,
    ) -> Result<()> {
        // Don't start if already running
        {
            let lock = self.monitors.lock().unwrap();
            if lock.contains_key(&session_id) {
                return Ok(());
            }
        }

        // Open a dedicated SSH connection for monitoring
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        tcp.set_read_timeout(Some(Duration::from_secs(10)))?;
        tcp.set_write_timeout(Some(Duration::from_secs(10)))?;

        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        authenticate_session(&mut session, &profile, secret.as_deref())?;

        let stop_flag = Arc::new(Mutex::new(false));
        let stop_clone = stop_flag.clone();

        let monitor_thread = MonitorThread { stop_flag };
        self.monitors
            .lock()
            .unwrap()
            .insert(session_id.clone(), monitor_thread);

        let monitors_ref = self.monitors.clone();
        let sid = session_id.clone();

        thread::spawn(move || {
            let mut prev_cpu: Option<(u64, u64)> = None;

            loop {
                // Check stop flag
                if *stop_clone.lock().unwrap() {
                    break;
                }

                // Collect all metrics with a single compound command
                let cmd = concat!(
                    "cat /proc/stat | head -1 && echo '---SEP---' && ",
                    "free -b | head -3 && echo '---SEP---' && ",
                    "df -B1 / | tail -1 && echo '---SEP---' && ",
                    "cat /proc/loadavg && echo '---SEP---' && ",
                    "uptime -p 2>/dev/null || uptime && echo '---SEP---' && ",
                    "hostname && echo '---SEP---' && ",
                    "cat /etc/os-release 2>/dev/null | head -1 || uname -s"
                );

                match exec_command(&session, cmd) {
                    Ok(output) => {
                        let sections: Vec<&str> = output.split("---SEP---").collect();
                        if sections.len() < 7 {
                            thread::sleep(Duration::from_secs(3));
                            continue;
                        }

                        // Parse CPU
                        let cpu_percent = parse_cpu(sections[0].trim(), &mut prev_cpu);

                        // Parse RAM
                        let (ram_total, ram_used, ram_percent) = parse_memory(sections[1].trim());

                        // Parse Disk
                        let (disk_total, disk_used, disk_percent) = parse_disk(sections[2].trim());

                        // Parse Load
                        let (load_1, load_5, load_15) = parse_loadavg(sections[3].trim());

                        // Uptime
                        let uptime = sections[4].trim().to_string();

                        // Hostname
                        let hostname = sections[5].trim().to_string();

                        // OS Info
                        let os_raw = sections[6].trim();
                        let os_info = if os_raw.starts_with("PRETTY_NAME=") {
                            os_raw
                                .trim_start_matches("PRETTY_NAME=")
                                .trim_matches('"')
                                .to_string()
                        } else {
                            os_raw.to_string()
                        };

                        let metrics = ServerMetrics {
                            cpu_percent,
                            ram_total,
                            ram_used,
                            ram_percent,
                            disk_total,
                            disk_used,
                            disk_percent,
                            load_1,
                            load_5,
                            load_15,
                            uptime,
                            hostname,
                            os_info,
                        };

                        let _ = app.emit(&format!("monitor_data_{}", sid), &metrics);
                    }
                    Err(_) => {
                        // Connection lost, stop monitoring
                        break;
                    }
                }

                // Wait 3 seconds before next poll
                for _ in 0..30 {
                    thread::sleep(Duration::from_millis(100));
                    if *stop_clone.lock().unwrap() {
                        break;
                    }
                }
            }

            // Cleanup
            monitors_ref.lock().unwrap().remove(&sid);
        });

        Ok(())
    }

    pub fn stop(&self, session_id: &str) {
        let lock = self.monitors.lock().unwrap();
        if let Some(monitor) = lock.get(session_id) {
            *monitor.stop_flag.lock().unwrap() = true;
        }
    }
}

fn exec_command(session: &Session, cmd: &str) -> Result<String> {
    session.set_blocking(true);
    let mut channel = session.channel_session().map_err(|e| AppError::Ssh(e))?;
    channel.exec(cmd).map_err(|e| AppError::Ssh(e))?;

    let mut output = String::new();
    channel
        .read_to_string(&mut output)
        .map_err(|e| AppError::Io(e))?;

    channel.wait_close().ok();
    Ok(output)
}

fn parse_cpu(raw: &str, prev: &mut Option<(u64, u64)>) -> f64 {
    // Format: cpu  user nice system idle iowait irq softirq steal
    let parts: Vec<&str> = raw.split_whitespace().collect();
    if parts.len() < 5 {
        return 0.0;
    }

    let values: Vec<u64> = parts[1..].iter().filter_map(|s| s.parse().ok()).collect();
    if values.len() < 4 {
        return 0.0;
    }

    let idle = values[3];
    let total: u64 = values.iter().sum();

    if let Some((prev_idle, prev_total)) = prev {
        let d_total = total.saturating_sub(*prev_total);
        let d_idle = idle.saturating_sub(*prev_idle);
        *prev = Some((idle, total));
        if d_total == 0 {
            return 0.0;
        }
        ((d_total - d_idle) as f64 / d_total as f64 * 100.0)
            .min(100.0)
            .max(0.0)
    } else {
        *prev = Some((idle, total));
        // First sample — return rough estimate
        if total == 0 {
            return 0.0;
        }
        ((total - idle) as f64 / total as f64 * 100.0)
            .min(100.0)
            .max(0.0)
    }
}

fn parse_memory(raw: &str) -> (u64, u64, f64) {
    // Format:
    //               total        used        free      shared  buff/cache   available
    // Mem:   ...
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Mem:") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 4 {
                let total: u64 = parts[1].parse().unwrap_or(0);
                let used: u64 = parts[2].parse().unwrap_or(0);
                let percent = if total > 0 {
                    used as f64 / total as f64 * 100.0
                } else {
                    0.0
                };
                return (total, used, percent);
            }
        }
    }
    (0, 0, 0.0)
}

fn parse_disk(raw: &str) -> (u64, u64, f64) {
    // Format: /dev/xxx  total  used  avail  percent  mount
    let parts: Vec<&str> = raw.split_whitespace().collect();
    if parts.len() >= 4 {
        let total: u64 = parts[1].parse().unwrap_or(0);
        let used: u64 = parts[2].parse().unwrap_or(0);
        let percent = if total > 0 {
            used as f64 / total as f64 * 100.0
        } else {
            0.0
        };
        return (total, used, percent);
    }
    (0, 0, 0.0)
}

fn parse_loadavg(raw: &str) -> (f64, f64, f64) {
    // Format: 0.15 0.10 0.05 1/234 12345
    let parts: Vec<&str> = raw.split_whitespace().collect();
    if parts.len() >= 3 {
        let l1: f64 = parts[0].parse().unwrap_or(0.0);
        let l5: f64 = parts[1].parse().unwrap_or(0.0);
        let l15: f64 = parts[2].parse().unwrap_or(0.0);
        return (l1, l5, l15);
    }
    (0.0, 0.0, 0.0)
}
