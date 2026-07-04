use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crossbeam_channel::{unbounded, Sender};
use ssh2::Session;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

const OUTPUT_BATCH_INTERVAL_MS: u64 = 16;
const OUTPUT_BATCH_MAX_SIZE: usize = 32768;

#[derive(Clone)]
pub struct SshPayload {
    pub session_id: String,
    pub data: Vec<u8>,
}

pub struct ActiveSession {
    pub profile_id: String,
    pub session_id: String,
    pub session: Session,
    tx: Sender<Vec<u8>>,
    resize_tx: Sender<(u32, u32)>,
}

impl ActiveSession {
    pub fn write_data(&self, data: Vec<u8>) {
        let _ = self.tx.send(data);
    }

    pub fn resize(&self, cols: u32, rows: u32) {
        let _ = self.resize_tx.send((cols, rows));
    }
}

pub struct SshManager {
    active_sessions: Arc<Mutex<std::collections::HashMap<String, ActiveSession>>>,
}

impl Default for SshManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub fn test_connection(&self, profile: &SshProfile, secret: Option<&str>) -> Result<()> {
        let addr = format!("{}:{}", profile.host, profile.port)
            .to_socket_addrs()
            .map_err(|e| AppError::Custom(format!("Invalid address: {}", e)))?
            .next()
            .ok_or_else(|| AppError::Custom("Could not resolve address".to_string()))?;
        let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(5))?;
        let _ = tcp.set_read_timeout(Some(Duration::from_secs(5)));
        let _ = tcp.set_write_timeout(Some(Duration::from_secs(5)));

        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        authenticate_session(&mut session, profile, secret)?;

        Ok(())
    }

    pub fn connect(
        &self,
        app: AppHandle,
        profile: SshProfile,
        secret: Option<String>,
        session_id: String,
    ) -> Result<()> {
        let active_sessions = self.active_sessions.clone();

        thread::spawn(move || {
            let status_event = format!("ssh_status_{}", session_id);

            // ── TCP Connect ─────────────────────────────────────
            let _ = app.emit(&status_event, serde_json::json!({
                "status": "connecting",
                "message": format!("Connecting to {}:{}...", profile.host, profile.port)
            }));

            let addr = match format!("{}:{}", profile.host, profile.port)
                .to_socket_addrs()
                .map_err(|e| format!("Invalid address: {}", e))
                .and_then(|mut addrs| addrs.next().ok_or_else(|| "Could not resolve address".to_string()))
            {
                Ok(a) => a,
                Err(e) => {
                    let _ = app.emit(&status_event, serde_json::json!({
                        "status": "error",
                        "message": e
                    }));
                    return;
                }
            };

            let tcp = match TcpStream::connect_timeout(&addr, Duration::from_secs(10)) {
                Ok(tcp) => tcp,
                Err(e) => {
                    let _ = app.emit(&status_event, serde_json::json!({
                        "status": "error",
                        "message": format!("Connection failed: {}", e)
                    }));
                    return;
                }
            };

            // ── SSH Handshake ────────────────────────────────────
            let _ = app.emit(&status_event, serde_json::json!({
                "status": "handshake",
                "message": "SSH handshake..."
            }));

            let mut session = match Session::new() {
                Ok(s) => s,
                Err(e) => {
                    let _ = app.emit(&status_event, serde_json::json!({
                        "status": "error",
                        "message": format!("Session error: {}", e)
                    }));
                    return;
                }
            };
            session.set_tcp_stream(tcp);

            if let Err(e) = session.handshake() {
                let _ = app.emit(&status_event, serde_json::json!({
                    "status": "error",
                    "message": format!("Handshake failed: {}", e)
                }));
                return;
            }

            // ── Authentication ───────────────────────────────────
            let _ = app.emit(&status_event, serde_json::json!({
                "status": "authenticating",
                "message": "Authenticating..."
            }));

            if let Err(e) = authenticate_session(&mut session, &profile, secret.as_deref()) {
                let _ = app.emit(&status_event, serde_json::json!({
                    "status": "error",
                    "message": format!("Authentication failed: {}", e)
                }));
                return;
            }

            // ── Channel Setup ────────────────────────────────────
            let mut channel = match session.channel_session() {
                Ok(ch) => ch,
                Err(e) => {
                    let _ = app.emit(&status_event, serde_json::json!({
                        "status": "error",
                        "message": format!("Channel error: {}", e)
                    }));
                    return;
                }
            };

            if let Err(e) = channel.request_pty("xterm", None, None) {
                let _ = app.emit(&status_event, serde_json::json!({
                    "status": "error",
                    "message": format!("PTY error: {}", e)
                }));
                return;
            }

            if let Err(e) = channel.exec("bash -l").or_else(|_| channel.shell()) {
                let _ = app.emit(&status_event, serde_json::json!({
                    "status": "error",
                    "message": format!("Shell error: {}", e)
                }));
                return;
            }

            // ── Register active session ──────────────────────────
            let (tx, rx) = unbounded::<Vec<u8>>();
            let (resize_tx, resize_rx) = unbounded::<(u32, u32)>();

            let active_session = ActiveSession {
                profile_id: profile.id.clone(),
                session_id: session_id.clone(),
                session: session.clone(),
                tx,
                resize_tx,
            };

            active_sessions
                .lock()
                .unwrap()
                .insert(session_id.clone(), active_session);

            // ── Emit connected ───────────────────────────────────
            let _ = app.emit(&status_event, serde_json::json!({
                "status": "connected",
                "message": "Connected successfully."
            }));

            // ── I/O Loop ─────────────────────────────────────────
            let mut buf = [0u8; 4096];
            let mut output_buffer: Vec<u8> = Vec::with_capacity(OUTPUT_BATCH_MAX_SIZE);
            let mut last_flush = Instant::now();

            session.set_blocking(false);

            loop {
                let mut activity = false;

                match channel.read(&mut buf) {
                    Ok(0) => {
                        if !output_buffer.is_empty() {
                            let _ = app.emit(
                                &format!("ssh_data_rx_{}", session_id),
                                output_buffer.clone(),
                            );
                        }
                        let _ = app.emit(&format!("ssh_close_{}", session_id), ());
                        break;
                    }
                    Ok(n) => {
                        output_buffer.extend_from_slice(&buf[..n]);
                        activity = true;

                        let should_flush = output_buffer.len() >= OUTPUT_BATCH_MAX_SIZE
                            || last_flush.elapsed().as_millis() as u64 >= OUTPUT_BATCH_INTERVAL_MS;

                        if should_flush && !output_buffer.is_empty() {
                            let _ = app.emit(
                                &format!("ssh_data_rx_{}", session_id),
                                output_buffer.clone(),
                            );
                            output_buffer.clear();
                            output_buffer.reserve(OUTPUT_BATCH_MAX_SIZE);
                            last_flush = Instant::now();
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                    Err(_) => {
                        if !output_buffer.is_empty() {
                            let _ = app.emit(
                                &format!("ssh_data_rx_{}", session_id),
                                output_buffer.clone(),
                            );
                        }
                        let _ = app.emit(&format!("ssh_close_{}", session_id), ());
                        break;
                    }
                }

                if let Ok(data) = rx.try_recv() {
                    let mut pos = 0;
                    while pos < data.len() {
                        match channel.write(&data[pos..]) {
                            Ok(n) => pos += n,
                            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                thread::sleep(Duration::from_millis(5));
                            }
                            Err(_) => break,
                        }
                    }
                    let _ = channel.flush();
                    activity = true;
                }

                if let Ok((cols, rows)) = resize_rx.try_recv() {
                    session.set_blocking(true);
                    let _ = channel.request_pty_size(cols, rows, None, None);
                    session.set_blocking(false);
                    activity = true;
                }

                if !activity {
                    if !output_buffer.is_empty()
                        && last_flush.elapsed().as_millis() as u64 >= OUTPUT_BATCH_INTERVAL_MS
                    {
                        let _ = app.emit(
                            &format!("ssh_data_rx_{}", session_id),
                            output_buffer.clone(),
                        );
                        output_buffer.clear();
                        output_buffer.reserve(OUTPUT_BATCH_MAX_SIZE);
                        last_flush = Instant::now();
                    }
                    thread::sleep(Duration::from_millis(15));
                }
            }

            let _ = channel.close();
            let _ = channel.wait_close();
        });

        Ok(())
    }

    pub fn write_to_session(&self, session_id: &str, data: Vec<u8>) -> Result<()> {
        let lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.get(session_id) {
            session.write_data(data);
            Ok(())
        } else {
            Err(AppError::Custom("Session not found".to_string()))
        }
    }

    pub fn resize_session(&self, session_id: &str, cols: u32, rows: u32) -> Result<()> {
        let lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.get(session_id) {
            session.resize(cols, rows);
            Ok(())
        } else {
            Err(AppError::Custom("Session not found".to_string()))
        }
    }

    pub fn close_session(&self, session_id: &str) {
        let mut lock = self.active_sessions.lock().unwrap();
        lock.remove(session_id);
    }

    pub fn get_session(&self, session_id: &str) -> Option<Session> {
        let lock = self.active_sessions.lock().unwrap();
        lock.get(session_id).map(|s| s.session.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_manager_new() {
        let manager = SshManager::new();
        assert!(manager.active_sessions.lock().unwrap().is_empty());
    }

    #[test]
    fn test_ssh_payload_clone() {
        let payload = SshPayload {
            session_id: "test-session".to_string(),
            data: vec![1, 2, 3, 4],
        };
        let cloned = payload.clone();
        assert_eq!(cloned.session_id, "test-session");
        assert_eq!(cloned.data, vec![1, 2, 3, 4]);
    }

    #[test]
    fn test_active_session_write_data() {
        let (tx, rx) = unbounded::<Vec<u8>>();
        let session = ActiveSession {
            profile_id: "profile-1".to_string(),
            session_id: "session-1".to_string(),
            session: Session::new().unwrap(),
            tx,
            resize_tx: unbounded().0,
        };

        session.write_data(vec![1, 2, 3]);
        assert_eq!(rx.try_recv().unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn test_active_session_resize() {
        let (resize_tx, _) = unbounded::<(u32, u32)>();
        let session = ActiveSession {
            profile_id: "profile-1".to_string(),
            session_id: "session-1".to_string(),
            session: Session::new().unwrap(),
            tx: unbounded().0,
            resize_tx,
        };
        session.resize(80, 24); // Should not panic
    }

    #[test]
    fn test_ssh_manager_session_not_found() {
        let manager = SshManager::new();

        let err = manager.write_to_session("nonexistent", vec![1, 2, 3]);
        assert!(err.unwrap_err().to_string().contains("Session not found"));

        let err2 = manager.resize_session("nonexistent", 80, 24);
        assert!(err2.unwrap_err().to_string().contains("Session not found"));

        manager.close_session("nonexistent"); // Should not panic
        assert!(manager.get_session("nonexistent").is_none());
    }

    #[test]
    fn test_active_session_fields() {
        let session = ActiveSession {
            profile_id: "test-profile".to_string(),
            session_id: "test-session".to_string(),
            session: Session::new().unwrap(),
            tx: unbounded().0,
            resize_tx: unbounded().0,
        };

        assert_eq!(session.profile_id, "test-profile");
        assert_eq!(session.session_id, "test-session");
    }

    #[test]
    fn test_output_batch_constants() {
        assert!(OUTPUT_BATCH_INTERVAL_MS > 0 && OUTPUT_BATCH_INTERVAL_MS < 1000);
        assert!(OUTPUT_BATCH_MAX_SIZE > 0 && OUTPUT_BATCH_MAX_SIZE >= 1024);
        assert!(!Duration::from_millis(OUTPUT_BATCH_INTERVAL_MS).is_zero());
    }

    #[test]
    fn test_ssh_payload_struct() {
        let payload = SshPayload {
            session_id: "session-123".to_string(),
            data: vec![1, 2, 3, 4, 5],
        };
        assert_eq!(payload.session_id, "session-123");
        assert_eq!(payload.data.len(), 5);
    }

    #[test]
    fn test_crossbeam_channel_operations() {
        let (tx, rx): (Sender<i32>, _) = unbounded();
        tx.send(42).unwrap();
        assert_eq!(rx.recv().unwrap(), 42);

        tx.send(100).unwrap();
        tx.send(200).unwrap();
        assert_eq!(rx.try_iter().collect::<Vec<_>>(), vec![100, 200]);
    }
}
