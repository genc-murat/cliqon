use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crossbeam_channel::{unbounded, Sender};
use tauri::{AppHandle, Emitter};

use super::{connection_stop::ConnectionStop, host_keys, tunnel::TunnelService};

use crate::error::{AppError, Result};
use crate::models::profile::{SshProfile, TunnelConfig};
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
    profile: SshProfile,
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

struct Connection {
    stop: Arc<ConnectionStop>,
    active: Option<ActiveSession>,
}

#[derive(Clone)]
pub struct SshManager {
    active_sessions: Arc<Mutex<std::collections::HashMap<String, Connection>>>,
    pub tunnels: TunnelService,
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
            tunnels: TunnelService::new(),
        }
    }

    pub fn test_connection(&self, profile: &SshProfile, secret: Option<&str>) -> Result<()> {
        let mut session = host_keys::handshake(host_keys::connect_tcp(profile)?)?;
        authenticate_session(&mut session, profile, secret)
    }

    pub fn connect(
        &self,
        app: AppHandle,
        profile: SshProfile,
        secret: Option<String>,
        session_id: String,
    ) -> Result<()> {
        let stop = Arc::new(ConnectionStop::default());
        {
            let mut sessions = self.active_sessions.lock().unwrap();
            if sessions.contains_key(&session_id) {
                return Err(AppError::Custom("SSH session already exists".into()));
            }
            sessions.insert(
                session_id.clone(),
                Connection {
                    stop: stop.clone(),
                    active: None,
                },
            );
        }

        let manager = self.clone();
        thread::spawn(move || {
            let outcome =
                manager.run_connection(&app, &profile, secret.as_deref(), &session_id, &stop);
            let mut sessions = manager.active_sessions.lock().unwrap();
            let is_current = sessions
                .get(&session_id)
                .is_some_and(|connection| Arc::ptr_eq(&connection.stop, &stop));
            if !is_current {
                return;
            }

            sessions.remove(&session_id);
            manager.tunnels.stop_session(&session_id);
            stop.cancel();
            drop(sessions);

            match outcome {
                Ok(()) => {
                    let _ = app.emit(&format!("ssh_close_{session_id}"), ());
                }
                Err(error) => ssh_status(&app, &session_id, "error", &error.to_string()),
            }
        });
        Ok(())
    }

    fn run_connection(
        &self,
        app: &AppHandle,
        profile: &SshProfile,
        secret: Option<&str>,
        session_id: &str,
        stop: &Arc<ConnectionStop>,
    ) -> Result<()> {
        ssh_status(
            app,
            session_id,
            "connecting",
            &format!("Connecting to {}:{}...", profile.host, profile.port),
        );
        let stream = host_keys::connect_tcp(profile)?;
        stop.attach(&stream)?;

        ssh_status(app, session_id, "handshake", "SSH handshake...");
        let mut session = host_keys::handshake(stream)?;
        ssh_status(
            app,
            session_id,
            "authenticating",
            "Verifying server and authenticating...",
        );
        authenticate_session(&mut session, profile, secret)?;

        let mut channel = session.channel_session()?;
        channel.request_pty("xterm", None, None)?;
        channel.exec("bash -l").or_else(|_| channel.shell())?;
        session.set_blocking(false);

        let (tx, rx) = unbounded::<Vec<u8>>();
        let (resize_tx, resize_rx) = unbounded::<(u32, u32)>();
        {
            let mut sessions = self.active_sessions.lock().unwrap();
            let current = sessions
                .get_mut(session_id)
                .filter(|connection| Arc::ptr_eq(&connection.stop, stop))
                .ok_or_else(|| AppError::Custom("Connection cancelled".into()))?;
            current.active = Some(ActiveSession {
                profile_id: profile.id.clone(),
                session_id: session_id.into(),
                profile: profile.clone(),
                tx,
                resize_tx,
            });
        }

        ssh_status(app, session_id, "connected", "Connected successfully.");
        let data_event = format!("ssh_data_rx_{session_id}");
        let mut buffer = [0u8; 4096];
        let mut output = Vec::with_capacity(OUTPUT_BATCH_MAX_SIZE);
        let mut last_flush = Instant::now();
        let mut input = None;
        let mut resize = None;

        let result = loop {
            if stop.is_cancelled() {
                break Ok(());
            }

            let mut activity = false;
            match channel.read(&mut buffer) {
                Ok(0) => break Ok(()),
                Ok(count) => {
                    output.extend_from_slice(&buffer[..count]);
                    activity = true;
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(error) => break Err(error.into()),
            }
            if !output.is_empty()
                && (output.len() >= OUTPUT_BATCH_MAX_SIZE
                    || last_flush.elapsed() >= Duration::from_millis(OUTPUT_BATCH_INTERVAL_MS))
            {
                let _ = app.emit(&data_event, &output);
                output.clear();
                last_flush = Instant::now();
            }

            if input.is_none() {
                input = rx
                    .try_recv()
                    .ok()
                    .filter(|bytes| !bytes.is_empty())
                    .map(|bytes| (bytes, 0));
            }
            if let Some((bytes, offset)) = &mut input {
                match channel.write(&bytes[*offset..]) {
                    Ok(0) => break Err(std::io::Error::from(std::io::ErrorKind::WriteZero).into()),
                    Ok(count) => {
                        *offset += count;
                        if *offset == bytes.len() {
                            input = None;
                        }
                        activity = true;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                    Err(error) => break Err(error.into()),
                }
            }

            if let Ok(latest) = resize_rx.try_recv() {
                resize = Some(latest);
            }
            if let Some((cols, rows)) = resize {
                match channel.request_pty_size(cols, rows, None, None) {
                    Err(error) if error.code() == ssh2::ErrorCode::Session(-37) => {}
                    _ => {
                        resize = None;
                    }
                }
            }

            if !activity {
                thread::sleep(Duration::from_millis(15));
            }
        };

        if !output.is_empty() && !stop.is_cancelled() {
            let _ = app.emit(&data_event, &output);
        }
        let _ = channel.close();
        result
    }

    pub fn write_to_session(&self, session_id: &str, data: Vec<u8>) -> Result<()> {
        let sessions = self.active_sessions.lock().unwrap();
        let session = sessions
            .get(session_id)
            .and_then(|connection| connection.active.as_ref())
            .ok_or_else(|| AppError::Custom("Session not found".into()))?;
        session.write_data(data);
        Ok(())
    }

    pub fn resize_session(&self, session_id: &str, cols: u32, rows: u32) -> Result<()> {
        let sessions = self.active_sessions.lock().unwrap();
        let session = sessions
            .get(session_id)
            .and_then(|connection| connection.active.as_ref())
            .ok_or_else(|| AppError::Custom("Session not found".into()))?;
        session.resize(cols, rows);
        Ok(())
    }

    pub fn close_session(&self, session_id: &str) {
        let mut sessions = self.active_sessions.lock().unwrap();
        if let Some(connection) = sessions.remove(session_id) {
            connection.stop.cancel();
            self.tunnels.stop_session(session_id);
        }
    }

    pub fn start_tunnel(
        &self,
        session_id: String,
        config: TunnelConfig,
        get_secret: impl FnOnce(&SshProfile) -> Result<Option<String>>,
    ) -> Result<()> {
        let (profile, stop) = {
            let sessions = self.active_sessions.lock().unwrap();
            let connection = sessions
                .get(&session_id)
                .ok_or_else(|| AppError::Custom("SSH Session not found".into()))?;
            let active = connection
                .active
                .as_ref()
                .ok_or_else(|| AppError::Custom("SSH session is still connecting".into()))?;
            (active.profile.clone(), connection.stop.clone())
        };
        let secret = get_secret(&profile)?;
        self.tunnels
            .start_tunnel(&profile, secret.as_deref(), config, session_id, &stop)
    }
}

fn ssh_status(app: &AppHandle, session_id: &str, status: &str, message: &str) {
    let _ = app.emit(
        &format!("ssh_status_{session_id}"),
        serde_json::json!({ "status": status, "message": message }),
    );
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
            profile: SshProfile::default(),
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
            profile: SshProfile::default(),
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
        assert!(manager.active_sessions.lock().unwrap().is_empty());
    }

    #[test]
    fn closing_a_pending_session_cancels_its_worker() {
        let manager = SshManager::new();
        let stop = Arc::new(ConnectionStop::default());
        manager.active_sessions.lock().unwrap().insert(
            "pending".into(),
            Connection {
                stop: stop.clone(),
                active: None,
            },
        );

        manager.close_session("pending");

        assert!(stop.is_cancelled());
        assert!(manager.active_sessions.lock().unwrap().is_empty());
    }

    #[test]
    fn test_active_session_fields() {
        let session = ActiveSession {
            profile_id: "test-profile".to_string(),
            session_id: "test-session".to_string(),
            profile: SshProfile::default(),
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
