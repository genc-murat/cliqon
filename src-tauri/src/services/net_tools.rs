use std::io::Read;
use std::net::TcpStream;
use std::time::Duration;

use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

pub struct NetToolManager;

impl NetToolManager {
    pub fn new() -> Self {
        Self
    }

    /// Run a network diagnostic tool on the remote host via SSH exec.
    /// `tool_type`: "ping" | "traceroute" | "dns"
    /// `target`: the hostname or IP to test
    pub fn run_tool(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        tool_type: &str,
        target: &str,
    ) -> Result<String> {
        // Sanitize target to prevent command injection
        let safe_target: String = target
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == ':' || *c == '_')
            .collect();

        if safe_target.is_empty() {
            return Err(AppError::Custom("Invalid target".into()));
        }

        let cmd = match tool_type {
            "ping" => format!("ping -c 10 -i 0.3 {} 2>&1", safe_target),
            "traceroute" => format!(
                "traceroute -m 30 {} 2>&1 || tracepath {} 2>&1",
                safe_target, safe_target
            ),
            "dns" => format!(
                "dig +noall +answer {} ANY 2>&1 || nslookup {} 2>&1 || host {} 2>&1",
                safe_target, safe_target, safe_target
            ),
            _ => return Err(AppError::Custom(format!("Unknown tool type: {}", tool_type))),
        };

        // Open a dedicated SSH connection for this one-shot command
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        tcp.set_read_timeout(Some(Duration::from_secs(60)))?;
        tcp.set_write_timeout(Some(Duration::from_secs(10)))?;

        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        authenticate_session(&mut session, profile, secret)?;

        // Execute the command
        session.set_blocking(true);
        let mut channel = session.channel_session().map_err(AppError::Ssh)?;
        channel.exec(&cmd).map_err(AppError::Ssh)?;

        let mut output = String::new();
        channel.read_to_string(&mut output).map_err(AppError::Io)?;
        channel.wait_close().ok();

        Ok(output)
    }
}
