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
use crate::models::sftp::{FileNode, FileProperties, mode_to_display};
use crate::services::auth::authenticate_session;

pub enum SftpCommand {
    ListDir(String),
    Download(String, String), // (remote_path, local_path)
    Upload(String, String),   // (local_path, remote_path)
    Rename(String, String),   // (old_path, new_path)
    Delete(String, bool),     // (path, is_dir)
    Stat(String),             // (path)
    Chmod(String, u32),       // (path, mode)
    ReadFile(String),         // (remote_path)
    WriteFile(String, String), // (remote_path, content)
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
                                    path: p.to_string_lossy().into_owned().replace("\\", "/"),
                                    is_dir,
                                    size,
                                    modified_at,
                                });
                            }
                        }
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
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), &local);
                        } else {
                            let _ = app.emit(&format!("sftp_transfer_error_{}", sid), &remote);
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
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), &remote);
                        } else {
                            let _ = app.emit(&format!("sftp_transfer_error_{}", sid), &local);
                        }
                    }

                    SftpCommand::Rename(old_path, new_path) => {
                        let res = sftp.rename(Path::new(&old_path), Path::new(&new_path), None);
                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_rename_done_{}", sid), &new_path);
                        } else {
                            let err = res.unwrap_err().to_string();
                            let _ = app.emit(&format!("sftp_rename_error_{}", sid), err);
                        }
                    }

                    SftpCommand::Delete(path, is_dir) => {
                        let res = if is_dir {
                            sftp.rmdir(Path::new(&path))
                        } else {
                            sftp.unlink(Path::new(&path))
                        };
                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_delete_done_{}", sid), &path);
                        } else {
                            let err = res.unwrap_err().to_string();
                            let _ = app.emit(&format!("sftp_delete_error_{}", sid), err);
                        }
                    }

                    SftpCommand::Stat(path) => {
                        match sftp.stat(Path::new(&path)) {
                            Ok(stat) => {
                                let perm = stat.perm.unwrap_or(0) & 0o777;
                                let name = Path::new(&path)
                                    .file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .into_owned();
                                let props = FileProperties {
                                    name,
                                    path: path.clone(),
                                    is_dir: stat.is_dir(),
                                    size: stat.size.unwrap_or(0),
                                    modified_at: stat.mtime.unwrap_or(0),
                                    permissions: perm,
                                    permissions_display: mode_to_display(perm),
                                    uid: stat.uid.unwrap_or(0),
                                    gid: stat.gid.unwrap_or(0),
                                };
                                let _ = app.emit(&format!("sftp_stat_rx_{}", sid), props);
                            }
                            Err(e) => {
                                let _ = app.emit(&format!("sftp_stat_error_{}", sid), e.to_string());
                            }
                        }
                    }

                    SftpCommand::Chmod(path, mode) => {
                        // Use setstat to change permissions
                        let stat = ssh2::FileStat {
                            size: None,
                            uid: None,
                            gid: None,
                            perm: Some(mode),
                            atime: None,
                            mtime: None,
                        };
                        let res = sftp.setstat(Path::new(&path), stat);
                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_chmod_done_{}", sid), &path);
                        } else {
                            let err = res.unwrap_err().to_string();
                            let _ = app.emit(&format!("sftp_chmod_error_{}", sid), err);
                        }
                    }

                    SftpCommand::ReadFile(path) => {
                        let res = (|| -> Result<String> {
                            let mut remote_f = sftp.open(Path::new(&path))?;
                            let mut buf = Vec::new();
                            remote_f.read_to_end(&mut buf)?;
                            Ok(String::from_utf8_lossy(&buf).into_owned())
                        })();
                        match res {
                            Ok(content) => {
                                let _ = app.emit(&format!("sftp_readfile_rx_{}", sid), content);
                            }
                            Err(e) => {
                                let _ = app.emit(&format!("sftp_readfile_error_{}", sid), e.to_string());
                            }
                        }
                    }

                    SftpCommand::WriteFile(path, content) => {
                        let res = (|| -> Result<()> {
                            let mut remote_f = sftp.create(Path::new(&path))?;
                            remote_f.write_all(content.as_bytes())?;
                            Ok(())
                        })();
                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_writefile_done_{}", sid), &path);
                        } else {
                            let _ = app.emit(&format!("sftp_writefile_error_{}", sid), res.unwrap_err().to_string());
                        }
                    }

                    SftpCommand::Close => {
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    pub fn list_dir(&self, session_id: &str, path: String) -> Result<()> {
        self.send(session_id, SftpCommand::ListDir(path))
    }

    pub fn upload(&self, session_id: &str, local_path: String, remote_path: String) -> Result<()> {
        self.send(session_id, SftpCommand::Upload(local_path, remote_path))
    }

    pub fn download(&self, session_id: &str, remote_path: String, local_path: String) -> Result<()> {
        self.send(session_id, SftpCommand::Download(remote_path, local_path))
    }

    pub fn rename(&self, session_id: &str, old_path: String, new_path: String) -> Result<()> {
        self.send(session_id, SftpCommand::Rename(old_path, new_path))
    }

    pub fn delete(&self, session_id: &str, path: String, is_dir: bool) -> Result<()> {
        self.send(session_id, SftpCommand::Delete(path, is_dir))
    }

    pub fn stat(&self, session_id: &str, path: String) -> Result<()> {
        self.send(session_id, SftpCommand::Stat(path))
    }

    pub fn chmod(&self, session_id: &str, path: String, mode: u32) -> Result<()> {
        self.send(session_id, SftpCommand::Chmod(path, mode))
    }

    pub fn read_file(&self, session_id: &str, path: String) -> Result<()> {
        self.send(session_id, SftpCommand::ReadFile(path))
    }

    pub fn write_file(&self, session_id: &str, path: String, content: String) -> Result<()> {
        self.send(session_id, SftpCommand::WriteFile(path, content))
    }

    pub fn close_session(&self, session_id: &str) {
        let mut lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.remove(session_id) {
            let _ = session.tx.send(SftpCommand::Close);
        }
    }

    fn send(&self, session_id: &str, cmd: SftpCommand) -> Result<()> {
        let lock = self.active_sessions.lock().unwrap();
        if let Some(session) = lock.get(session_id) {
            let _ = session.tx.send(cmd);
            Ok(())
        } else {
            Err(AppError::Custom("SFTP session not found".to_string()))
        }
    }
}
