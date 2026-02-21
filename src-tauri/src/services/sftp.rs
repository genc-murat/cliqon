use std::fs::File;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;

use crossbeam_channel::{unbounded, Sender};
use ssh2::Session;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::models::sftp::FileNode;
use crate::services::auth::authenticate_session;

pub enum SftpCommand {
    ListDir(String),
    Download(String, String), // (remote_path, local_path)
    Upload(String, String),   // (local_path, remote_path)
    Close,
}

pub struct ActiveSftp {
    tx: Sender<SftpCommand>,
}

pub struct SftpManager {
    active_sessions: Arc<Mutex<std::collections::HashMap<String, ActiveSftp>>>,
}

impl SftpManager {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
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

        let sftp = session.sftp()?;

        let (tx, rx) = unbounded::<SftpCommand>();

        let active_session = ActiveSftp { tx };
        self.active_sessions.lock().unwrap().insert(session_id.clone(), active_session);

        let sid = session_id.clone();
        
        thread::spawn(move || {
            // Processing loop for SFTP commands
            for cmd in rx {
                match cmd {
                    SftpCommand::ListDir(path) => {
                        let mut nodes = Vec::new();
                        if let Ok(dir) = sftp.readdir(Path::new(&path)) {
                            for (p, stat) in dir {
                                let name = p.file_name().unwrap_or_default().to_string_lossy().into_owned();
                                if name == "." || name == ".." {
                                    continue;
                                }
                                let is_dir = stat.is_dir();
                                let size = stat.size.unwrap_or(0);
                                let modified_at = stat.mtime.unwrap_or(0);
                                nodes.push(FileNode {
                                    name,
                                    path: p.to_string_lossy().into_owned(),
                                    is_dir,
                                    size,
                                    modified_at,
                                });
                            }
                        }
                        // Sort: directories first, then alphabetical
                        nodes.sort_by(|a, b| {
                            b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
                        });

                        let _ = app.emit(&format!("sftp_dir_rx_{}", sid), nodes);
                    }
                    SftpCommand::Download(remote, local) => {
                        let _ = app.emit(&format!("sftp_transfer_start_{}", sid), "download");
                        let res = (|| -> Result<()> {
                            let mut remote_f = sftp.open(Path::new(&remote))?;
                            let mut local_f = File::create(Path::new(&local))?;
                            let mut buf = [0u8; 8192];
                            loop {
                                let n = remote_f.read(&mut buf)?;
                                if n == 0 { break; }
                                local_f.write_all(&buf[..n])?;
                            }
                            Ok(())
                        })();
                        
                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), local);
                        } else {
                            let _ = app.emit(&format!("sftp_transfer_error_{}", sid), remote);
                        }
                    }
                    SftpCommand::Upload(local, remote) => {
                        let _ = app.emit(&format!("sftp_transfer_start_{}", sid), "upload");
                        let res = (|| -> Result<()> {
                            let mut local_f = File::open(Path::new(&local))?;
                            let mut remote_f = sftp.create(Path::new(&remote))?;
                            let mut buf = [0u8; 8192];
                            loop {
                                let n = local_f.read(&mut buf)?;
                                if n == 0 { break; }
                                remote_f.write_all(&buf[..n])?;
                            }
                            Ok(())
                        })();

                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), remote);
                        } else {
                            let _ = app.emit(&format!("sftp_transfer_error_{}", sid), local);
                        }
                    }
                    SftpCommand::Close => {
                        break;
                    }
                }
            }
            // SSH Session gets dropped here closing SFTP layer cleanly
        });

        Ok(())
    }

    pub fn list_dir(&self, session_id: &str, path: String) -> Result<()> {
        let lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.get(session_id) {
            let _ = session.tx.send(SftpCommand::ListDir(path));
            Ok(())
        } else {
            Err(AppError::Custom("SFTP session not found".to_string()))
        }
    }

    pub fn upload(&self, session_id: &str, local_path: String, remote_path: String) -> Result<()> {
        let lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.get(session_id) {
            let _ = session.tx.send(SftpCommand::Upload(local_path, remote_path));
            Ok(())
        } else {
            Err(AppError::Custom("SFTP session not found".to_string()))
        }
    }

    pub fn download(&self, session_id: &str, remote_path: String, local_path: String) -> Result<()> {
        let lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.get(session_id) {
            let _ = session.tx.send(SftpCommand::Download(remote_path, local_path));
            Ok(())
        } else {
            Err(AppError::Custom("SFTP session not found".to_string()))
        }
    }

    pub fn close_session(&self, session_id: &str) {
        let mut lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.remove(session_id) {
            let _ = session.tx.send(SftpCommand::Close);
        }
    }
}
