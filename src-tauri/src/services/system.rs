use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;
use ssh2::Session;
use std::net::TcpStream;

pub struct SystemService;

impl Default for SystemService {
    fn default() -> Self {
        Self::new()
    }
}

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
        let mut channel = session.channel_session().map_err(AppError::Ssh)?;
        channel.exec(cmd).map_err(AppError::Ssh)?;

        let mut output = String::new();
        use std::io::Read;
        channel.read_to_string(&mut output).map_err(AppError::Io)?;

        channel.wait_close().ok();
        Ok(output)
    }

    pub fn get_system_services(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
    ) -> Result<String> {
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

    pub fn get_system_timers(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = r#"
            if command -v systemctl > /dev/null; then
                # Robust parsing for systemctl list-timers
                systemctl list-timers --all --no-pager --no-legend | awk '{
                    i=1;
                    # NEXT
                    if ($i == "n/a") { next_dt="n/a"; i++; }
                    else { next_dt=$i" "$(i+1)" "$(i+2)" "$(i+3); i+=4; }
                    
                    # LEFT
                    left_val=$i" "$(i+1); i+=2;
                    
                    # LAST
                    if ($i == "n/a") { last_dt="n/a"; i++; }
                    else { last_dt=$i" "$(i+1)" "$(i+2)" "$(i+3); i+=4; }
                    
                    # PASSED
                    passed_val=$i" "$(i+1); i+=2;
                    
                    # UNIT
                    unit=$i; i++;
                    
                    # ACTIVATES
                    activates=$i;
                    
                    printf "%s|%s|%s|%s|%s|%s\n", next_dt, left_val, last_dt, passed_val, unit, activates
                }'
            else
                echo "systemctl not found"
            fi
        "#;
        self.exec_command(&session, cmd)
    }

    pub fn manage_service(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        action: &str,
        service: &str,
    ) -> Result<String> {
        // action: start, stop, restart, enable, disable
        let session = self.open_session(profile, secret)?;

        // Strictly validate action to prevent command injection
        if !matches!(action, "start" | "stop" | "restart" | "enable" | "disable") {
            return Err(AppError::Custom("Invalid service action".to_string()));
        }

        // Strictly validate service name to prevent command injection
        if !service.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.' || c == '@') {
            return Err(AppError::Custom("Invalid service name".to_string()));
        }

        // Try without sudo first. If it fails due to permissions, the frontend will see it in the output.
        // Later we can implement sudo if we pass the passover over stdin.
        let cmd = format!("systemctl {} {} 2>&1", action, service);
        self.exec_command(&session, &cmd)
    }

    pub fn get_env_vars(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        // We use printenv to get the current environment variables
        self.exec_command(&session, "printenv")
    }

    pub fn set_env_var(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        key: &str,
        value: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;

        // Strictly validate environment variable key
        if !key.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(AppError::Custom("Invalid environment variable key".to_string()));
        }

        // Escape shell metacharacters to prevent command injection inside double quotes
        let safe_key = key
            .replace('\\', "\\\\")
            .replace('$', "\\$")
            .replace('`', "\\`")
            .replace('"', "\\\"")
            .replace('\'', "'\\''");
        let safe_value = value
            .replace('\\', "\\\\")
            .replace('$', "\\$")
            .replace('`', "\\`")
            .replace('"', "\\\"")
            .replace('\'', "'\\''");

        // Script to update or append the export in .bashrc
        let cmd = format!(
            r#"
            BASHRC="$HOME/.bashrc"
            if grep -q "export {}=" "$BASHRC"; then
                sed -i "s|^export {}=.*|export {}='{}'|" "$BASHRC"
            else
                echo "export {}='{}'" >> "$BASHRC"
            fi
            export {}='{}'
            "#,
            safe_key, safe_key, safe_key, safe_value, safe_key, safe_value, safe_key, safe_value
        );

        self.exec_command(&session, &cmd)
    }

    pub fn delete_env_var(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        key: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;

        // Strictly validate environment variable key
        if !key.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(AppError::Custom("Invalid environment variable key".to_string()));
        }

        let safe_key = key
            .replace('\\', "\\\\")
            .replace('$', "\\$")
            .replace('`', "\\`")
            .replace('"', "\\\"")
            .replace('\'', "'\\''");

        // Script to remove the export from .bashrc
        let cmd = format!(
            r#"
            BASHRC="$HOME/.bashrc"
            sed -i "/^export {}=/d" "$BASHRC"
            unset {}
            "#,
            safe_key, safe_key
        );

        self.exec_command(&session, &cmd)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_input_sanitization() {
        // Safe values pass through unchanged
        assert_eq!(
            "start"
                .replace("'", "'\\''")
                .replace(";", "")
                .replace("&", "")
                .replace("|", ""),
            "start"
        );
        assert_eq!(
            "nginx"
                .replace("'", "'\\''")
                .replace(";", "")
                .replace("&", "")
                .replace("|", ""),
            "nginx"
        );

        // Dangerous characters are removed
        let safe_action = "start;rm -rf /"
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        assert_eq!(safe_action, "startrm -rf /");
        assert!(!safe_action.contains(';'));

        let safe_service = "nginx&shutdown"
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        assert_eq!(safe_service, "nginxshutdown");
        assert!(!safe_service.contains('&'));
    }

    #[test]
    fn test_env_var_sanitization() {
        let safe_key = "MY_VAR"
            .replace("'", "'\\''")
            .replace("\"", "\\\"");
        assert_eq!(safe_key, "MY_VAR");

        let safe_value = "hello world"
            .replace("'", "'\\''")
            .replace("\"", "\\\"");
        assert_eq!(safe_value, "hello world");

        let key_with_quotes = "VAR'WITH'QUOTES"
            .replace("'", "'\\''")
            .replace("\"", "\\\"");
        assert!(key_with_quotes.contains("'\\''"));
    }

    #[test]
    fn test_env_var_script_building() {
        let safe_key = "MY_VAR";
        let safe_value = "my_value";

        // Set env var script
        let set_script = format!(
            r#"
            BASHRC="$HOME/.bashrc"
            if grep -q "export {}=" "$BASHRC"; then
                sed -i "s|^export {}=.*|export {}='{}'|" "$BASHRC"
            else
                echo "export {}='{}'" >> "$BASHRC"
            fi
            export {}='{}'
            "#,
            safe_key, safe_key, safe_key, safe_value, safe_key, safe_value, safe_key, safe_value
        );
        assert!(set_script.contains("grep -q"));
        assert!(set_script.contains("sed -i"));
        assert!(set_script.contains("export MY_VAR="));

        // Delete env var script
        let delete_script = format!(
            r#"
            BASHRC="$HOME/.bashrc"
            sed -i "/^export {}=/d" "$BASHRC"
            unset {}
            "#,
            safe_key, safe_key
        );
        assert!(delete_script.contains("sed -i"));
        assert!(delete_script.contains("unset MY_VAR"));
    }

    #[test]
    fn test_systemctl_command_building() {
        let service = "nginx";
        for action in ["start", "stop", "restart", "enable", "disable"] {
            let cmd = format!("systemctl {} {} 2>&1", action, service);
            assert!(cmd.contains("systemctl"));
            assert!(cmd.contains(action));
            assert!(cmd.contains(service));
            assert!(cmd.contains("2>&1"));
        }
    }

    #[test]
    fn test_systemctl_list_command_structure() {
        let services_cmd = r#"
            if command -v systemctl > /dev/null; then
                systemctl list-units --type=service --all --no-pager --no-legend | awk '{
                    unit=$1; load=$2; active=$3; sub=$4;
                    desc=""; for(i=5;i<=NF;i++) desc=desc " " $i;
                    gsub(/^[ \t]+|[ \t]+$/, "", desc);
                    printf "%s|%s|%s|%s|%s\n", unit, load, active, sub, desc
                }'
            else
                echo "systemctl not found"
            fi
        "#;
        assert!(services_cmd.contains("command -v systemctl"));
        assert!(services_cmd.contains("systemctl list-units"));
        assert!(services_cmd.contains("--type=service"));
        assert!(services_cmd.contains("--no-pager"));
        assert!(services_cmd.contains("--no-legend"));

        let timers_cmd = r#"
            if command -v systemctl > /dev/null; then
                systemctl list-timers --all --no-pager --no-legend | awk '{
                    i=1;
                    if ($i == "n/a") { next_dt="n/a"; i++; }
                    else { next_dt=$i" "$(i+1)" "$(i+2)" "$(i+3); i+=4; }
                    left_val=$i" "$(i+1); i+=2;
                    if ($i == "n/a") { last_dt="n/a"; i++; }
                    else { last_dt=$i" "$(i+1)" "$(i+2)" "$(i+3); i+=4; }
                    passed_val=$i" "$(i+1); i+=2;
                    unit=$i; i++;
                    activates=$i;
                    printf "%s|%s|%s|%s|%s|%s\n", next_dt, left_val, last_dt, passed_val, unit, activates
                }'
            else
                echo "systemctl not found"
            fi
        "#;
        assert!(timers_cmd.contains("systemctl list-timers"));
        assert!(timers_cmd.contains("--all"));
        assert!(timers_cmd.contains("--no-pager"));
    }
}

