use std::io::{Read, Write};
use std::net::TcpStream;
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

impl SshManager {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub fn test_connection(&self, profile: &SshProfile, secret: Option<&str>) -> Result<()> {
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

        let (tx, rx) = unbounded::<Vec<u8>>();
        let (resize_tx, resize_rx) = unbounded::<(u32, u32)>();

        let active_session = ActiveSession {
            profile_id: profile.id.clone(),
            session_id: session_id.clone(),
            session: session.clone(),
            tx,
            resize_tx,
        };

        self.active_sessions
            .lock()
            .unwrap()
            .insert(session_id.clone(), active_session);

        thread::spawn(move || {
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
