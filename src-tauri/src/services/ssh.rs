use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crossbeam_channel::{unbounded, Sender};
use ssh2::Session;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

#[derive(Clone)]
pub struct SshPayload {
    pub session_id: String,
    pub data: Vec<u8>,
}

pub struct ActiveSession {
    pub profile_id: String,
    pub session_id: String, // Unique tab/session ID
    // Sender to send keystrokes/data to the SSH write loop
    tx: Sender<Vec<u8>>,
    // Sender to send resize events (cols, rows)
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
    // Map of active SSH sessions to their write channels
    active_sessions: Arc<Mutex<std::collections::HashMap<String, ActiveSession>>>,
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub fn test_connection(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
    ) -> Result<()> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
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
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        authenticate_session(&mut session, &profile, secret.as_deref())?;

        let mut channel = session.channel_session()?;
        channel.request_pty("xterm", None, None)?;
        channel.exec("bash -l").or_else(|_| channel.shell())?;

        // We use non-blocking approach to handle both reads from SSH and writes from Tauri in a single thread thread
        let (tx, rx) = unbounded::<Vec<u8>>();
        let (resize_tx, resize_rx) = unbounded::<(u32, u32)>();

        let active_session = ActiveSession {
            profile_id: profile.id.clone(),
            session_id: session_id.clone(),
            tx,
            resize_tx,
        };

        self.active_sessions.lock().unwrap().insert(session_id.clone(), active_session);

        // Spawn actor thread
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            // Non-blocking loop requires setting the channel to non-blocking
            // However, ssh2-rs has some quirks with non-blocking PTYs,
            // we will set session to non-blocking.
            session.set_blocking(false);

            loop {
                let mut activity = false;

                // 1. Read from SSH, send to Tauri frontend
                match channel.read(&mut buf) {
                    Ok(0) => {
                        // EOF, connection closed
                        let _ = app.emit(&format!("ssh_close_{}", session_id), ());
                        break;
                    }
                    Ok(n) => {
                        let data = buf[..n].to_vec();
                        let _ = app.emit(&format!("ssh_data_rx_{}", session_id), data);
                        activity = true;
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // Keep going
                    }
                    Err(_) => {
                        // Ignore or handle errors, then exit loop
                        let _ = app.emit(&format!("ssh_close_{}", session_id), ());
                        break;
                    }
                }

                // 2. Read from Tauri, send to SSH
                if let Ok(data) = rx.try_recv() {
                    let mut pos = 0;
                    while pos < data.len() {
                        match channel.write(&data[pos..]) {
                            Ok(n) => pos += n,
                            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                thread::sleep(Duration::from_millis(5));
                            }
                            Err(_) => break, // Error writing
                        }
                    }
                    if let Err(_) = channel.flush() {
                        // Ignore flush errors for now
                    }
                    activity = true;
                }

                // 3. Handle Resize events
                if let Ok((cols, rows)) = resize_rx.try_recv() {
                    // Temporarily set to blocking to resize
                    session.set_blocking(true);
                    let _ = channel.request_pty_size(cols, rows, None, None);
                    session.set_blocking(false);
                    activity = true;
                }

                if !activity {
                    // Small sleep to prevent 100% CPU core usage
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
}
