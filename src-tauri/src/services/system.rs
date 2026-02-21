use ssh2::Session;
use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;
use std::net::TcpStream;

pub struct SystemService;

impl SystemService {
    pub fn new() -> Self {
        Self
    }

    fn open_session(&self, profile: &SshProfile, secret: Option<&str>) -> Result<Session> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
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
        use std::io::Read;
        channel.read_to_string(&mut output).map_err(|e| AppError::Io(e))?;

        channel.wait_close().ok();
        Ok(output)
    }

    pub fn get_system_services(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        // We output as JSON manually using awk/jq if possible, or just raw output and parse in JS.
        // `systemctl list-units --type=service --all` is standard on systemd.
        let cmd = r#"
            if command -v systemctl > /dev/null; then
                # Output format: UNIT LOAD ACTIVE SUB DESCRIPTION
                systemctl list-units --type=service --all --no-pager --no-legend | awk '{
                    unit=$1; load=$2; active=$3; sub=$4;
                    // Description is the rest of the line
                    desc=""; for(i=5;i<=NF;i++) desc=desc " " $i;
                    gsub(/^[ \t]+|[ \t]+$/, "", desc);
                    printf "%s|%s|%s|%s|%s\n", unit, load, active, sub, desc
                }'
            else
                echo "systemctl not found"
            fi
        "#;
        self.exec_command(&session, cmd)
    }

    pub fn manage_service(&self, profile: &SshProfile, secret: Option<&str>, action: &str, service: &str) -> Result<String> {
        // action: start, stop, restart, enable, disable
        let session = self.open_session(profile, secret)?;
        
        let safe_action = action.replace("'", "'\\''").replace(";", "").replace("&", "").replace("|", "");
        let safe_service = service.replace("'", "'\\''").replace(";", "").replace("&", "").replace("|", "");
        
        // Try without sudo first. If it fails due to permissions, the frontend will see it in the output.
        // Later we can implement sudo if we pass the passover over stdin.
        let cmd = format!("systemctl {} {} 2>&1", safe_action, safe_service);
        self.exec_command(&session, &cmd)
    }
}
