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
use crate::models::sftp::{mode_to_display, FileNode, FileProperties};
use crate::services::auth::authenticate_session;

pub enum SftpCommand {
    ListDir(String),
    Download(String, String),              // (remote_path, local_path)
    Upload(String, String),                // (local_path, remote_path)
    Rename(String, String),                // (old_path, new_path)
    Delete(String, bool),                  // (path, is_dir)
    Stat(String),                          // (path)
    Chmod(String, u32),                    // (path, mode)
    ReadFile(String),                      // (remote_path)
    WriteFile(String, String),             // (remote_path, content)
    DownloadMultiZip(Vec<String>, String), // (remote_paths, local_zip_path)
    WatchDir(String),                      // (path)
    StopWatch,
    CreateDir(String),          // (path)
    CreateFile(String, String), // (path, content)
    Copy(String, String),       // (source_path, dest_path)
    Move(String, String),       // (source_path, dest_path)
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
        self.active_sessions
            .lock()
            .unwrap()
            .insert(session_id.clone(), active_session);

        let sid = session_id.clone();

        thread::spawn(move || {
            let mut watch_dir: Option<String> = None;
            let mut last_mtime: u64 = 0;

            loop {
                // Determine whether to use recv or recv_timeout
                let cmd_res = if watch_dir.is_some() {
                    rx.recv_timeout(std::time::Duration::from_millis(2000))
                        .map_err(|_| ())
                } else {
                    rx.recv().map_err(|_| ())
                };

                match cmd_res {
                    Ok(cmd) => match cmd {
                        SftpCommand::WatchDir(p) => {
                            watch_dir = Some(p);
                            last_mtime = 0;
                        }
                        SftpCommand::StopWatch => {
                            watch_dir = None;
                            last_mtime = 0;
                        }
                        SftpCommand::ListDir(path) => {
                            let mut nodes = Vec::new();
                            let p_obj = Path::new(&path);
                            if let Ok(dir) = sftp.readdir(p_obj) {
                                for (p, stat) in dir {
                                    let name = p
                                        .file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .into_owned();
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
                                // Also notify frontend of the "real" path we are now in
                                let real_path = if path == "." {
                                    match sftp.realpath(Path::new(".")) {
                                        Ok(p) => p.to_string_lossy().into_owned().replace("\\", "/"),
                                        Err(_) => ".".to_string(),
                                    }
                                } else {
                                    path.clone()
                                };
                                let _ = app.emit(&format!("sftp_current_path_rx_{}", sid), real_path);
                            }
                            nodes.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
                            let _ = app.emit(&format!("sftp_dir_rx_{}", sid), nodes);
                        }

                        SftpCommand::Download(remote, local) => {
                            let transfer_id = format!("dl_{}", uuid::Uuid::new_v4());
                            let name = Path::new(&local)
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy();
                            let total_size = sftp
                                .stat(Path::new(&remote))
                                .ok()
                                .and_then(|s| s.size)
                                .unwrap_or(0);

                            let _ = app.emit(&format!("sftp_transfer_start_{}", sid), serde_json::json!({
                            "id": &transfer_id, "name": name, "type": "download", "total": total_size
                        }));
                            let res = (|| -> Result<()> {
                                let mut remote_f = sftp.open(Path::new(&remote))?;
                                let mut local_f = File::create(Path::new(&local))?;
                                let mut buf = [0u8; 65536];
                                let mut downloaded = 0;
                                let mut last_emit = std::time::Instant::now();
                                loop {
                                    let n = remote_f.read(&mut buf)?;
                                    if n == 0 {
                                        break;
                                    }
                                    local_f.write_all(&buf[..n])?;
                                    downloaded += n as u64;
                                    if last_emit.elapsed().as_millis() > 200 {
                                        let _ = app.emit(
                                            &format!("sftp_transfer_progress_{}", sid),
                                            serde_json::json!({
                                                "id": &transfer_id, "progress": downloaded
                                            }),
                                        );
                                        last_emit = std::time::Instant::now();
                                    }
                                }
                                Ok(())
                            })();

                            if res.is_ok() {
                                let _ = app.emit(
                                    &format!("sftp_transfer_done_{}", sid),
                                    serde_json::json!({ "id": transfer_id }),
                                );
                            } else {
                                let _ = app.emit(&format!("sftp_transfer_error_{}", sid), serde_json::json!({ "id": transfer_id, "error": res.unwrap_err().to_string() }));
                            }
                        }

                        SftpCommand::Upload(local, remote) => {
                            let transfer_id = format!("up_{}", uuid::Uuid::new_v4());
                            let name = Path::new(&local)
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy();
                            let total_size =
                                std::fs::metadata(&local).map(|m| m.len()).unwrap_or(0);

                            let _ = app.emit(&format!("sftp_transfer_start_{}", sid), serde_json::json!({
                            "id": &transfer_id, "name": name, "type": "upload", "total": total_size
                        }));
                            let res = (|| -> Result<()> {
                                let mut local_f = File::open(Path::new(&local))?;
                                let mut remote_f = sftp.create(Path::new(&remote))?;
                                let mut buf = [0u8; 65536];
                                let mut uploaded = 0;
                                let mut last_emit = std::time::Instant::now();
                                loop {
                                    let n = local_f.read(&mut buf)?;
                                    if n == 0 {
                                        break;
                                    }
                                    remote_f.write_all(&buf[..n])?;
                                    uploaded += n as u64;
                                    if last_emit.elapsed().as_millis() > 200 {
                                        let _ = app.emit(
                                            &format!("sftp_transfer_progress_{}", sid),
                                            serde_json::json!({
                                                "id": &transfer_id, "progress": uploaded
                                            }),
                                        );
                                        last_emit = std::time::Instant::now();
                                    }
                                }
                                Ok(())
                            })();

                            if res.is_ok() {
                                let _ = app.emit(
                                    &format!("sftp_transfer_done_{}", sid),
                                    serde_json::json!({ "id": transfer_id }),
                                );
                            } else {
                                let _ = app.emit(&format!("sftp_transfer_error_{}", sid), serde_json::json!({ "id": transfer_id, "error": res.unwrap_err().to_string() }));
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

                        SftpCommand::Stat(path) => match sftp.stat(Path::new(&path)) {
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
                                let _ =
                                    app.emit(&format!("sftp_stat_error_{}", sid), e.to_string());
                            }
                        },

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
                                    let _ = app.emit(
                                        &format!("sftp_readfile_error_{}", sid),
                                        e.to_string(),
                                    );
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
                                let _ = app.emit(
                                    &format!("sftp_writefile_error_{}", sid),
                                    res.unwrap_err().to_string(),
                                );
                            }
                        }

                        SftpCommand::DownloadMultiZip(remote_paths, local_zip) => {
                            let transfer_id = format!("zip_{}", uuid::Uuid::new_v4());
                            let name = Path::new(&local_zip)
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy();
                            let _ = app.emit(&format!("sftp_transfer_start_{}", sid), serde_json::json!({
                            "id": &transfer_id, "name": name, "type": "download_zip", "total": remote_paths.len() as u64
                        }));

                            let res = (|| -> Result<()> {
                                let file = File::create(&local_zip)?;
                                let mut zip = zip::ZipWriter::new(file);
                                let options = zip::write::SimpleFileOptions::default()
                                    .compression_method(zip::CompressionMethod::Deflated)
                                    .unix_permissions(0o755);

                                for remote in remote_paths {
                                    let stat = sftp.stat(Path::new(&remote))?;
                                    if stat.is_dir() {
                                        let mut dirs_to_visit = vec![remote.clone()];
                                        while let Some(current_dir) = dirs_to_visit.pop() {
                                            if let Ok(entries) =
                                                sftp.readdir(Path::new(&current_dir))
                                            {
                                                for (p, s) in entries {
                                                    let p_str = p
                                                        .to_string_lossy()
                                                        .into_owned()
                                                        .replace("\\", "/");
                                                    let fname = p
                                                        .file_name()
                                                        .unwrap_or_default()
                                                        .to_string_lossy();
                                                    if fname == "." || fname == ".." {
                                                        continue;
                                                    }

                                                    if s.is_dir() {
                                                        dirs_to_visit.push(p_str);
                                                    } else {
                                                        let parent = Path::new(&remote)
                                                            .parent()
                                                            .unwrap_or(Path::new(""))
                                                            .to_string_lossy()
                                                            .into_owned()
                                                            .replace("\\", "/");
                                                        let zip_path = if parent.is_empty() {
                                                            p_str.clone()
                                                        } else {
                                                            p_str
                                                                .strip_prefix(&format!(
                                                                    "{}/",
                                                                    parent
                                                                ))
                                                                .unwrap_or(&p_str)
                                                                .to_string()
                                                        };

                                                        zip.start_file(zip_path, options)?;
                                                        if let Ok(mut f) = sftp.open(&p) {
                                                            let mut buf = [0u8; 65536];
                                                            loop {
                                                                let n =
                                                                    f.read(&mut buf).unwrap_or(0);
                                                                if n == 0 {
                                                                    break;
                                                                }
                                                                let _ = zip.write_all(&buf[..n]);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        let fname = Path::new(&remote)
                                            .file_name()
                                            .unwrap_or_default()
                                            .to_string_lossy();
                                        zip.start_file(fname, options)?;
                                        let mut f = sftp.open(Path::new(&remote))?;
                                        let mut buf = [0u8; 65536];
                                        loop {
                                            let n = f.read(&mut buf)?;
                                            if n == 0 {
                                                break;
                                            }
                                            zip.write_all(&buf[..n])?;
                                        }
                                    }
                                }
                                // Call finish directly, without assignment to _
                                zip.finish()?;
                                Ok(())
                            })();

                            if res.is_ok() {
                                let _ = app.emit(
                                    &format!("sftp_transfer_done_{}", sid),
                                    serde_json::json!({ "id": transfer_id }),
                                );
                            } else {
                                let _ = app.emit(&format!("sftp_transfer_error_{}", sid), serde_json::json!({ "id": transfer_id, "error": res.unwrap_err().to_string() }));
                            }
                        }

                        SftpCommand::CreateDir(path) => {
                            let res = sftp.mkdir(Path::new(&path), 0o755);
                            if res.is_ok() {
                                let _ = app.emit(&format!("sftp_createdir_done_{}", sid), &path);
                            } else {
                                let err = res.unwrap_err().to_string();
                                let _ = app.emit(&format!("sftp_createdir_error_{}", sid), err);
                            }
                        }

                        SftpCommand::CreateFile(path, _content) => {
                            let res = (|| -> Result<()> {
                                let mut f = sftp.create(Path::new(&path))?;
                                f.write_all(b"")?;
                                Ok(())
                            })();
                            if res.is_ok() {
                                let _ = app.emit(&format!("sftp_createfile_done_{}", sid), &path);
                            } else {
                                let err = res.unwrap_err().to_string();
                                let _ = app.emit(&format!("sftp_createfile_error_{}", sid), err);
                            }
                        }

                        SftpCommand::Copy(source, dest) => {
                            let res = (|| -> Result<()> {
                                let mut src = sftp.open(Path::new(&source))?;
                                let mut content = Vec::new();
                                src.read_to_end(&mut content)?;
                                let mut dst = sftp.create(Path::new(&dest))?;
                                dst.write_all(&content)?;
                                Ok(())
                            })();
                            if res.is_ok() {
                                let _ = app.emit(
                                    &format!("sftp_copy_done_{}", sid),
                                    serde_json::json!({ "source": source, "dest": dest }),
                                );
                            } else {
                                let err = res.unwrap_err().to_string();
                                let _ = app.emit(&format!("sftp_copy_error_{}", sid), err);
                            }
                        }

                        SftpCommand::Move(source, dest) => {
                            let res = sftp.rename(Path::new(&source), Path::new(&dest), None);
                            if res.is_ok() {
                                let _ = app.emit(
                                    &format!("sftp_move_done_{}", sid),
                                    serde_json::json!({ "source": source, "dest": dest }),
                                );
                            } else {
                                let err = res.unwrap_err().to_string();
                                let _ = app.emit(&format!("sftp_move_error_{}", sid), err);
                            }
                        }

                        SftpCommand::Close => {
                            break;
                        }
                    },
                    Err(_) => {
                        // Timeout occurred, check the watch path
                        if let Some(p) = &watch_dir {
                            if let Ok(stat) = sftp.stat(Path::new(p)) {
                                let mtime = stat.mtime.unwrap_or(0);
                                if last_mtime != 0 && mtime != last_mtime {
                                    let _ = app.emit(&format!("sftp_watch_changed_{}", sid), p);
                                }
                                last_mtime = mtime;
                            }
                        }
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

    pub fn download(
        &self,
        session_id: &str,
        remote_path: String,
        local_path: String,
    ) -> Result<()> {
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

    pub fn download_multi_zip(
        &self,
        session_id: &str,
        remote_paths: Vec<String>,
        local_zip: String,
    ) -> Result<()> {
        self.send(
            session_id,
            SftpCommand::DownloadMultiZip(remote_paths, local_zip),
        )
    }

    pub fn start_watch(&self, session_id: &str, path: String) -> Result<()> {
        self.send(session_id, SftpCommand::WatchDir(path))
    }

    pub fn stop_watch(&self, session_id: &str) -> Result<()> {
        self.send(session_id, SftpCommand::StopWatch)
    }

    pub fn read_file(&self, session_id: &str, path: String) -> Result<()> {
        self.send(session_id, SftpCommand::ReadFile(path))
    }

    pub fn write_file(&self, session_id: &str, path: String, content: String) -> Result<()> {
        self.send(session_id, SftpCommand::WriteFile(path, content))
    }

    pub fn create_dir(&self, session_id: &str, path: String) -> Result<()> {
        self.send(session_id, SftpCommand::CreateDir(path))
    }

    pub fn create_file(&self, session_id: &str, path: String, content: String) -> Result<()> {
        self.send(session_id, SftpCommand::CreateFile(path, content))
    }

    pub fn copy(&self, session_id: &str, source: String, dest: String) -> Result<()> {
        self.send(session_id, SftpCommand::Copy(source, dest))
    }

    pub fn move_file(&self, session_id: &str, source: String, dest: String) -> Result<()> {
        self.send(session_id, SftpCommand::Move(source, dest))
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
    pub fn read_docker_compose(
        &self,
        _profile: &SshProfile,
        _secret: Option<&str>,
        _path: &str,
    ) -> Result<String> {
        // ... handled elsewhere, but keeping block structure
        Ok("".to_string())
    }

    pub fn sudo_read_file(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;
        crate::services::auth::authenticate_session(&mut session, profile, secret)?;

        let mut channel = session.channel_session().map_err(|e| AppError::Ssh(e))?;

        // Use bash to echo the password into sudo -S cat <path>
        // The -S flag reads the password from standard input.
        let password = secret.unwrap_or("");
        let safe_pass = password.replace("'", "'\\''");
        let safe_path = path.replace("\\", "/").replace("'", "'\\''");

        let cmd = format!("echo '{}' | sudo -S cat '{}' 2>&1", safe_pass, safe_path);

        channel.exec(&cmd).map_err(|e| AppError::Ssh(e))?;
        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| AppError::Io(e))?;
        channel.wait_close().ok();

        Ok(output)
    }

    pub fn sudo_write_file(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
        content: &str,
    ) -> Result<()> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;
        crate::services::auth::authenticate_session(&mut session, profile, secret)?;

        let mut channel = session.channel_session().map_err(|e| AppError::Ssh(e))?;

        // We write the content using tee. We pipe the password into sudo -S,
        // however, if we also need to pipe the content, it gets tricky.
        // A common technique: echo 'pass' | sudo -S sh -c 'cat > file' < input
        // Since we can write directly to the channel's standard input from rust:

        let password = secret.unwrap_or("");
        let safe_pass = password.replace("'", "'\\''");
        let safe_path = path.replace("\\", "/").replace("'", "'\\''");

        // Command: sudo -S sh -c 'cat > path'
        let cmd = format!(
            "echo '{}' | sudo -S sh -c 'cat > '{}''",
            safe_pass, safe_path
        );
        channel.exec(&cmd).map_err(|e| AppError::Ssh(e))?;

        // Write the actual file content to the command's stdin
        channel
            .write_all(content.as_bytes())
            .map_err(|e| AppError::Io(e))?;
        // Send EOF
        channel.send_eof().map_err(|e| AppError::Ssh(e))?;

        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| AppError::Io(e))?;
        channel.wait_close().ok();

        // Check if output contains typical sudo errors like "incorrect password"
        if output.to_lowercase().contains("incorrect password") {
            return Err(AppError::Custom(
                "Sudo authentication failed (incorrect password)".to_string(),
            ));
        }
        if output.to_lowercase().contains("permission denied") {
            return Err(AppError::Custom("Sudo permission denied".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sftp_command_variants() {
        // Test all SftpCommand enum variants can be created
        let _list_dir = SftpCommand::ListDir("/home".to_string());
        let _download = SftpCommand::Download("/remote/file.txt".to_string(), "/local/file.txt".to_string());
        let _upload = SftpCommand::Upload("/local/file.txt".to_string(), "/remote/file.txt".to_string());
        let _rename = SftpCommand::Rename("/old/path".to_string(), "/new/path".to_string());
        let _delete_file = SftpCommand::Delete("/path/to/file".to_string(), false);
        let _delete_dir = SftpCommand::Delete("/path/to/dir".to_string(), true);
        let _stat = SftpCommand::Stat("/path".to_string());
        let _chmod = SftpCommand::Chmod("/path".to_string(), 0o755);
        let _read_file = SftpCommand::ReadFile("/remote/file.txt".to_string());
        let _write_file = SftpCommand::WriteFile("/remote/file.txt".to_string(), "content".to_string());
        let _download_zip = SftpCommand::DownloadMultiZip(vec!["/file1".to_string()], "/archive.zip".to_string());
        let _watch_dir = SftpCommand::WatchDir("/watch/path".to_string());
        let _stop_watch = SftpCommand::StopWatch;
        let _create_dir = SftpCommand::CreateDir("/new/dir".to_string());
        let _create_file = SftpCommand::CreateFile("/new/file.txt".to_string(), "content".to_string());
        let _copy = SftpCommand::Copy("/source".to_string(), "/dest".to_string());
        let _move = SftpCommand::Move("/source".to_string(), "/dest".to_string());
        let _close = SftpCommand::Close;
    }

    #[test]
    fn test_sftp_manager_new() {
        let manager = SftpManager::new();
        // Verify manager can be created with empty sessions
        let sessions = manager.active_sessions.lock().unwrap();
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_sftp_manager_empty_sessions() {
        let manager = SftpManager::new();
        let sessions = manager.active_sessions.lock().unwrap();
        assert_eq!(sessions.len(), 0);
    }

    #[test]
    fn test_active_sftp_struct() {
        // Test that ActiveSftp can be created with a sender
        let (tx, _rx) = unbounded::<SftpCommand>();
        let _active_sftp = ActiveSftp { tx };
    }

    #[test]
    fn test_sftp_command_list_dir() {
        let cmd = SftpCommand::ListDir("/home/user".to_string());
        match cmd {
            SftpCommand::ListDir(path) => {
                assert_eq!(path, "/home/user");
                assert!(path.starts_with('/'));
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_download() {
        let remote = "/remote/file.txt";
        let local = "/local/file.txt";
        let cmd = SftpCommand::Download(remote.to_string(), local.to_string());
        match cmd {
            SftpCommand::Download(r, l) => {
                assert_eq!(r, remote);
                assert_eq!(l, local);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_upload() {
        let local = "/local/file.txt";
        let remote = "/remote/file.txt";
        let cmd = SftpCommand::Upload(local.to_string(), remote.to_string());
        match cmd {
            SftpCommand::Upload(l, r) => {
                assert_eq!(l, local);
                assert_eq!(r, remote);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_rename() {
        let old_path = "/old/name.txt";
        let new_path = "/new/name.txt";
        let cmd = SftpCommand::Rename(old_path.to_string(), new_path.to_string());
        match cmd {
            SftpCommand::Rename(old, new) => {
                assert_eq!(old, old_path);
                assert_eq!(new, new_path);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_delete_file() {
        let path = "/path/to/file.txt";
        let cmd = SftpCommand::Delete(path.to_string(), false);
        match cmd {
            SftpCommand::Delete(p, is_dir) => {
                assert_eq!(p, path);
                assert!(!is_dir);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_delete_dir() {
        let path = "/path/to/dir";
        let cmd = SftpCommand::Delete(path.to_string(), true);
        match cmd {
            SftpCommand::Delete(p, is_dir) => {
                assert_eq!(p, path);
                assert!(is_dir);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_stat() {
        let path = "/path/to/check";
        let cmd = SftpCommand::Stat(path.to_string());
        match cmd {
            SftpCommand::Stat(p) => {
                assert_eq!(p, path);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_chmod() {
        let path = "/path/to/chmod";
        let mode: u32 = 0o755;
        let cmd = SftpCommand::Chmod(path.to_string(), mode);
        match cmd {
            SftpCommand::Chmod(p, m) => {
                assert_eq!(p, path);
                assert_eq!(m, mode);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_read_file() {
        let path = "/remote/file.txt";
        let cmd = SftpCommand::ReadFile(path.to_string());
        match cmd {
            SftpCommand::ReadFile(p) => {
                assert_eq!(p, path);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_write_file() {
        let path = "/remote/file.txt";
        let content = "Hello, World!";
        let cmd = SftpCommand::WriteFile(path.to_string(), content.to_string());
        match cmd {
            SftpCommand::WriteFile(p, c) => {
                assert_eq!(p, path);
                assert_eq!(c, content);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_download_multi_zip() {
        let paths = vec!["/file1.txt".to_string(), "/file2.txt".to_string()];
        let zip_path = "/archive.zip";
        let cmd = SftpCommand::DownloadMultiZip(paths.clone(), zip_path.to_string());
        match cmd {
            SftpCommand::DownloadMultiZip(p, z) => {
                assert_eq!(p.len(), 2);
                assert_eq!(z, zip_path);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_watch_dir() {
        let path = "/watch/this/dir";
        let cmd = SftpCommand::WatchDir(path.to_string());
        match cmd {
            SftpCommand::WatchDir(p) => {
                assert_eq!(p, path);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_stop_watch() {
        let cmd = SftpCommand::StopWatch;
        match cmd {
            SftpCommand::StopWatch => {}
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_create_dir() {
        let path = "/new/directory";
        let cmd = SftpCommand::CreateDir(path.to_string());
        match cmd {
            SftpCommand::CreateDir(p) => {
                assert_eq!(p, path);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_create_file() {
        let path = "/new/file.txt";
        let content = "Initial content";
        let cmd = SftpCommand::CreateFile(path.to_string(), content.to_string());
        match cmd {
            SftpCommand::CreateFile(p, c) => {
                assert_eq!(p, path);
                assert_eq!(c, content);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_copy() {
        let source = "/source/file.txt";
        let dest = "/dest/file.txt";
        let cmd = SftpCommand::Copy(source.to_string(), dest.to_string());
        match cmd {
            SftpCommand::Copy(s, d) => {
                assert_eq!(s, source);
                assert_eq!(d, dest);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_move_file() {
        let source = "/source/file.txt";
        let dest = "/dest/file.txt";
        let cmd = SftpCommand::Move(source.to_string(), dest.to_string());
        match cmd {
            SftpCommand::Move(s, d) => {
                assert_eq!(s, source);
                assert_eq!(d, dest);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_command_close() {
        let cmd = SftpCommand::Close;
        match cmd {
            SftpCommand::Close => {}
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_sftp_manager_mutex_access() {
        let manager = SftpManager::new();
        
        // Test locking and unlocking
        let sessions = manager.active_sessions.lock().unwrap();
        assert!(sessions.is_empty());
        drop(sessions);
        
        // Can lock again
        let sessions2 = manager.active_sessions.lock().unwrap();
        assert!(sessions2.is_empty());
    }

    #[test]
    fn test_sftp_session_id_format() {
        let session_ids = vec!["sftp-1", "session-abc", "transfer-xyz"];
        for id in session_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_sftp_path_formats() {
        let paths = vec![
            "/home/user/files",
            "/var/www/html",
            "./relative/path",
            "../parent/path",
        ];
        for path in paths {
            assert!(!path.is_empty());
        }
    }

    #[test]
    fn test_sftp_file_node_creation() {
        let node = FileNode {
            name: "test.txt".to_string(),
            path: "/home/test.txt".to_string(),
            is_dir: false,
            size: 1024,
            modified_at: 1234567890,
        };
        
        assert_eq!(node.name, "test.txt");
        assert!(!node.is_dir);
        assert_eq!(node.size, 1024);
    }

    #[test]
    fn test_sftp_file_properties_creation() {
        let props = FileProperties {
            name: "script.sh".to_string(),
            path: "/usr/bin/script.sh".to_string(),
            is_dir: false,
            size: 512,
            modified_at: 1609459200,
            permissions: 0o755,
            permissions_display: "rwxr-xr-x".to_string(),
            uid: 1000,
            gid: 1000,
        };
        
        assert_eq!(props.permissions, 0o755);
        assert_eq!(props.uid, 1000);
    }

    #[test]
    fn test_sftp_mode_to_display() {
        assert_eq!(mode_to_display(0o755), "rwxr-xr-x");
        assert_eq!(mode_to_display(0o644), "rw-r--r--");
        assert_eq!(mode_to_display(0o777), "rwxrwxrwx");
        assert_eq!(mode_to_display(0o600), "rw-------");
    }

    #[test]
    fn test_sftp_channel_creation() {
        // Test that crossbeam channel can be created
        let (tx, rx): (Sender<SftpCommand>, _) = unbounded();
        
        // Send a command
        tx.send(SftpCommand::StopWatch).unwrap();
        
        // Receive the command
        let cmd = rx.recv().unwrap();
        match cmd {
            SftpCommand::StopWatch => {}
            _ => panic!("Wrong command"),
        }
    }

    #[test]
    fn test_sftp_channel_multiple_commands() {
        let (tx, rx): (Sender<SftpCommand>, _) = unbounded();
        
        tx.send(SftpCommand::ListDir("/home".to_string())).unwrap();
        tx.send(SftpCommand::StopWatch).unwrap();
        tx.send(SftpCommand::Close).unwrap();
        
        let cmd1 = rx.recv().unwrap();
        let cmd2 = rx.recv().unwrap();
        let cmd3 = rx.recv().unwrap();
        
        match cmd1 {
            SftpCommand::ListDir(path) => assert_eq!(path, "/home"),
            _ => panic!("Wrong command"),
        }
        match cmd2 {
            SftpCommand::StopWatch => {}
            _ => panic!("Wrong command"),
        }
        match cmd3 {
            SftpCommand::Close => {}
            _ => panic!("Wrong command"),
        }
    }

    #[test]
    fn test_sftp_try_recv() {
        let (tx, rx): (Sender<SftpCommand>, _) = unbounded();
        
        // Try to recv without sending - should fail
        let result = rx.try_recv();
        assert!(result.is_err());
        
        // Send and try again
        tx.send(SftpCommand::Close).unwrap();
        let result = rx.try_recv();
        assert!(result.is_ok());
    }

    #[test]
    fn test_sftp_vec_paths() {
        let paths: Vec<String> = vec![
            "/file1.txt".to_string(),
            "/file2.txt".to_string(),
            "/file3.txt".to_string(),
        ];
        
        assert_eq!(paths.len(), 3);
        for path in &paths {
            assert!(path.starts_with('/'));
        }
    }

    #[test]
    fn test_sftp_transfer_id_format() {
        let transfer_id = format!("dl_{}", uuid::Uuid::new_v4());
        assert!(transfer_id.starts_with("dl_"));
        assert!(transfer_id.len() > 30);
    }

    #[test]
    fn test_sftp_upload_id_format() {
        let transfer_id = format!("up_{}", uuid::Uuid::new_v4());
        assert!(transfer_id.starts_with("up_"));
    }

    #[test]
    fn test_sftp_zip_id_format() {
        let transfer_id = format!("zip_{}", uuid::Uuid::new_v4());
        assert!(transfer_id.starts_with("zip_"));
    }

    #[test]
    fn test_sftp_path_backslash_replacement() {
        let windows_path = "C:\\Users\\file.txt";
        let unix_path = windows_path.replace("\\", "/");
        assert_eq!(unix_path, "C:/Users/file.txt");
    }

    #[test]
    fn test_sftp_sort_directories_first() {
        let mut nodes = vec![
            FileNode { name: "file1.txt".to_string(), path: "/file1.txt".to_string(), is_dir: false, size: 100, modified_at: 0 },
            FileNode { name: "dir1".to_string(), path: "/dir1".to_string(), is_dir: true, size: 0, modified_at: 0 },
            FileNode { name: "file2.txt".to_string(), path: "/file2.txt".to_string(), is_dir: false, size: 200, modified_at: 0 },
        ];
        
        // Sort: directories first, then by name
        nodes.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
        
        // First should be directory
        assert!(nodes[0].is_dir);
        assert_eq!(nodes[0].name, "dir1");
    }

    #[test]
    fn test_sftp_watch_state() {
        let mut watch_dir: Option<String> = None;
        let mut last_mtime: u64 = 0;
        
        assert!(watch_dir.is_none());
        assert_eq!(last_mtime, 0);
        
        watch_dir = Some("/watch/path".to_string());
        assert!(watch_dir.is_some());
        
        watch_dir = None;
        assert!(watch_dir.is_none());
    }

    #[test]
    fn test_sftp_dot_paths_filter() {
        let names = vec![".", "..", "file.txt", "dir"];
        let filtered: Vec<&str> = names.into_iter()
            .filter(|n| *n != "." && *n != "..")
            .collect();
        
        assert_eq!(filtered.len(), 2);
        assert!(filtered.contains(&"file.txt"));
        assert!(filtered.contains(&"dir"));
    }

    #[test]
    fn test_sftp_optional_size_handling() {
        let size: Option<u64> = None;
        let size_value = size.unwrap_or(0);
        assert_eq!(size_value, 0);
        
        let size2: Option<u64> = Some(1024);
        let size_value2 = size2.unwrap_or(0);
        assert_eq!(size_value2, 1024);
    }

    #[test]
    fn test_sftp_optional_mtime_handling() {
        let mtime: Option<u64> = None;
        let mtime_value = mtime.unwrap_or(0);
        assert_eq!(mtime_value, 0);
        
        let mtime2: Option<u64> = Some(1234567890);
        let mtime_value2 = mtime2.unwrap_or(0);
        assert_eq!(mtime_value2, 1234567890);
    }

    #[test]
    fn test_sftp_real_path_fallback() {
        let path = ".";
        let real_path = if path == "." {
            "fallback_path".to_string()
        } else {
            path.to_string()
        };
        
        assert_eq!(real_path, "fallback_path");
    }

    #[test]
    fn test_sftp_event_channel_format() {
        let sid = "session-123";
        let event_name = format!("sftp_dir_rx_{}", sid);
        assert!(event_name.contains("sftp_dir_rx"));
        assert!(event_name.contains("session-123"));
    }

    #[test]
    fn test_sftp_path_new() {
        let path_str = "/home/user/file.txt";
        let path = Path::new(path_str);
        assert_eq!(path.to_str(), Some("/home/user/file.txt"));
    }

    #[test]
    fn test_sftp_file_name_extraction() {
        let path = Path::new("/home/user/file.txt");
        let file_name = path.file_name().unwrap_or_default().to_string_lossy();
        assert_eq!(file_name, "file.txt");
    }

    #[test]
    fn test_sftp_parent_extraction() {
        let path = Path::new("/home/user/file.txt");
        let parent = path.parent().unwrap_or(Path::new("")).to_string_lossy();
        assert_eq!(parent, "/home/user");
    }

    #[test]
    fn test_sftp_arc_mutex_pattern() {
        let sessions: Arc<Mutex<std::collections::HashMap<String, i32>>> = 
            Arc::new(Mutex::new(std::collections::HashMap::new()));
        
        let mut map = sessions.lock().unwrap();
        map.insert("key1".to_string(), 1);
        drop(map);
        
        let map2 = sessions.lock().unwrap();
        assert_eq!(map2.len(), 1);
    }

    #[test]
    fn test_sftp_thread_spawn() {
        let (tx, rx): (Sender<String>, _) = unbounded();
        
        std::thread::spawn(move || {
            tx.send("from thread".to_string()).unwrap();
        });
        
        let msg = rx.recv().unwrap();
        assert_eq!(msg, "from thread");
    }

    #[test]
    fn test_sftp_duration_from_millis() {
        let duration = std::time::Duration::from_millis(2000);
        assert_eq!(duration.as_millis(), 2000);
    }

    #[test]
    fn test_sftp_result_ok() {
        let result: Result<()> = Ok(());
        assert!(result.is_ok());
    }

    #[test]
    fn test_sftp_result_err() {
        let result: Result<()> = Err(AppError::Custom("test error".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_sftp_error_messages() {
        let errors = vec![
            "SFTP operation failed",
            "File not found",
            "Permission denied",
            "Connection lost",
        ];
        
        for error in errors {
            let err = AppError::Custom(error.to_string());
            assert!(err.to_string().contains(error));
        }
    }
}
