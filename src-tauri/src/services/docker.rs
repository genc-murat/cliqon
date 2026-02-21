use std::io::Read;
use std::net::TcpStream;
use std::time::Duration;

use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

pub struct DockerManager {}

impl DockerManager {
    pub fn new() -> Self {
        Self {}
    }

    fn open_session(&self, profile: &SshProfile, secret: Option<&str>) -> Result<Session> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        tcp.set_read_timeout(Some(Duration::from_secs(10)))?;
        tcp.set_write_timeout(Some(Duration::from_secs(10)))?;

        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        authenticate_session(&mut session, profile, secret)?;

        Ok(session)
    }

    fn exec_command(&self, session: &Session, cmd: &str) -> Result<String> {
        session.set_blocking(true);
        let mut channel = session.channel_session().map_err(|e| AppError::Ssh(e))?;
        channel.exec(cmd).map_err(|e| AppError::Ssh(e))?;

        let mut output = String::new();
        channel.read_to_string(&mut output).map_err(|e| AppError::Io(e))?;

        channel.wait_close().ok();
        Ok(output)
    }

    pub fn get_containers(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker ps -a --format '{{json .}}'";
        self.exec_command(&session, cmd)
    }

    pub fn start_container(&self, profile: &SshProfile, secret: Option<&str>, container_id: &str) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker start {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn stop_container(&self, profile: &SshProfile, secret: Option<&str>, container_id: &str) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker stop {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn restart_container(&self, profile: &SshProfile, secret: Option<&str>, container_id: &str) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker restart {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn system_prune(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker system prune -af";
        self.exec_command(&session, cmd)
    }

    pub fn get_stats(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        // --no-stream ensures it returns immediately, --format formats it as JSON.
        let cmd = "docker stats --no-stream --format '{{json .}}'";
        self.exec_command(&session, cmd)
    }
}
