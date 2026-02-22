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
    DownloadMultiZip(Vec<String>, String), // (remote_paths, local_zip_path)
    WatchDir(String),         // (path)
    StopWatch,
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
            let mut watch_dir: Option<String> = None;
            let mut last_mtime: u64 = 0;

            loop {
                // Determine whether to use recv or recv_timeout
                let cmd_res = if watch_dir.is_some() {
                    rx.recv_timeout(std::time::Duration::from_millis(2000)).map_err(|_| ())
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
                        let transfer_id = format!("dl_{}", uuid::Uuid::new_v4());
                        let name = Path::new(&local).file_name().unwrap_or_default().to_string_lossy();
                        let total_size = sftp.stat(Path::new(&remote)).ok().and_then(|s| s.size).unwrap_or(0);

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
                                if n == 0 { break; }
                                local_f.write_all(&buf[..n])?;
                                downloaded += n as u64;
                                if last_emit.elapsed().as_millis() > 200 {
                                    let _ = app.emit(&format!("sftp_transfer_progress_{}", sid), serde_json::json!({
                                        "id": &transfer_id, "progress": downloaded
                                    }));
                                    last_emit = std::time::Instant::now();
                                }
                            }
                            Ok(())
                        })();

                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), serde_json::json!({ "id": transfer_id }));
                        } else {
                            let _ = app.emit(&format!("sftp_transfer_error_{}", sid), serde_json::json!({ "id": transfer_id, "error": res.unwrap_err().to_string() }));
                        }
                    }

                    SftpCommand::Upload(local, remote) => {
                        let transfer_id = format!("up_{}", uuid::Uuid::new_v4());
                        let name = Path::new(&local).file_name().unwrap_or_default().to_string_lossy();
                        let total_size = std::fs::metadata(&local).map(|m| m.len()).unwrap_or(0);

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
                                if n == 0 { break; }
                                remote_f.write_all(&buf[..n])?;
                                uploaded += n as u64;
                                if last_emit.elapsed().as_millis() > 200 {
                                    let _ = app.emit(&format!("sftp_transfer_progress_{}", sid), serde_json::json!({
                                        "id": &transfer_id, "progress": uploaded
                                    }));
                                    last_emit = std::time::Instant::now();
                                }
                            }
                            Ok(())
                        })();

                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), serde_json::json!({ "id": transfer_id }));
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

                    SftpCommand::DownloadMultiZip(remote_paths, local_zip) => {
                        let transfer_id = format!("zip_{}", uuid::Uuid::new_v4());
                        let name = Path::new(&local_zip).file_name().unwrap_or_default().to_string_lossy();
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
                                        if let Ok(entries) = sftp.readdir(Path::new(&current_dir)) {
                                            for (p, s) in entries {
                                                let p_str = p.to_string_lossy().into_owned().replace("\\", "/");
                                                let fname = p.file_name().unwrap_or_default().to_string_lossy();
                                                if fname == "." || fname == ".." { continue; }
                                                
                                                if s.is_dir() {
                                                    dirs_to_visit.push(p_str);
                                                } else {
                                                    let parent = Path::new(&remote).parent().unwrap_or(Path::new("")).to_string_lossy().into_owned().replace("\\", "/");
                                                    let zip_path = if parent.is_empty() {
                                                        p_str.clone()
                                                    } else {
                                                        p_str.strip_prefix(&format!("{}/", parent)).unwrap_or(&p_str).to_string()
                                                    };
                                                    
                                                    zip.start_file(zip_path, options)?;
                                                    if let Ok(mut f) = sftp.open(&p) {
                                                        let mut buf = [0u8; 65536];
                                                        loop {
                                                            let n = f.read(&mut buf).unwrap_or(0);
                                                            if n == 0 { break; }
                                                            let _ = zip.write_all(&buf[..n]);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    let fname = Path::new(&remote).file_name().unwrap_or_default().to_string_lossy();
                                    zip.start_file(fname, options)?;
                                    let mut f = sftp.open(Path::new(&remote))?;
                                    let mut buf = [0u8; 65536];
                                    loop {
                                        let n = f.read(&mut buf)?;
                                        if n == 0 { break; }
                                        zip.write_all(&buf[..n])?;
                                    }
                                }
                            }
                            // Call finish directly, without assignment to _
                            zip.finish()?;
                            Ok(())
                        })();

                        if res.is_ok() {
                            let _ = app.emit(&format!("sftp_transfer_done_{}", sid), serde_json::json!({ "id": transfer_id }));
                        } else {
                            let _ = app.emit(&format!("sftp_transfer_error_{}", sid), serde_json::json!({ "id": transfer_id, "error": res.unwrap_err().to_string() }));
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

    pub fn download_multi_zip(&self, session_id: &str, remote_paths: Vec<String>, local_zip: String) -> Result<()> {
        self.send(session_id, SftpCommand::DownloadMultiZip(remote_paths, local_zip))
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
    pub fn read_docker_compose(&self, _profile: &SshProfile, _secret: Option<&str>, _path: &str) -> Result<String> {
        // ... handled elsewhere, but keeping block structure 
        Ok("".to_string())
    }

    pub fn sudo_read_file(&self, profile: &SshProfile, secret: Option<&str>, path: &str) -> Result<String> {
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
        channel.read_to_string(&mut output).map_err(|e| AppError::Io(e))?;
        channel.wait_close().ok();
        
        Ok(output)
    }

    pub fn sudo_write_file(&self, profile: &SshProfile, secret: Option<&str>, path: &str, content: &str) -> Result<()> {
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
        let cmd = format!("echo '{}' | sudo -S sh -c 'cat > '{}''", safe_pass, safe_path);
        channel.exec(&cmd).map_err(|e| AppError::Ssh(e))?;
        
        // Write the actual file content to the command's stdin
        channel.write_all(content.as_bytes()).map_err(|e| AppError::Io(e))?;
        // Send EOF
        channel.send_eof().map_err(|e| AppError::Ssh(e))?;
        
        let mut output = String::new();
        channel.read_to_string(&mut output).map_err(|e| AppError::Io(e))?;
        channel.wait_close().ok();
        
        // Check if output contains typical sudo errors like "incorrect password"
        if output.to_lowercase().contains("incorrect password") {
            return Err(AppError::Custom("Sudo authentication failed (incorrect password)".to_string()));
        }
        if output.to_lowercase().contains("permission denied") {
            return Err(AppError::Custom("Sudo permission denied".to_string()));
        }
        
        Ok(())
    }
}
