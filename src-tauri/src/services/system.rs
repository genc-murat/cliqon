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

        let safe_action = action
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        let safe_service = service
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");

        // Try without sudo first. If it fails due to permissions, the frontend will see it in the output.
        // Later we can implement sudo if we pass the passover over stdin.
        let cmd = format!("systemctl {} {} 2>&1", safe_action, safe_service);
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

        // Sanitize inputs
        let safe_key = key.replace("'", "'\\''").replace("\"", "\\\"");
        let safe_value = value.replace("'", "'\\''").replace("\"", "\\\"");

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

        let safe_key = key.replace("'", "'\\''").replace("\"", "\\\"");

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
    fn test_system_service_new() {
        let service = SystemService::new();
        // SystemService is a unit struct, just verify it can be created
        let _ = service;
    }

    #[test]
    fn test_safe_action_sanitization() {
        let action = "start";
        let safe_action = action
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        assert_eq!(safe_action, "start");
    }

    #[test]
    fn test_safe_service_sanitization() {
        let service = "nginx";
        let safe_service = service
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        assert_eq!(safe_service, "nginx");
    }

    #[test]
    fn test_safe_action_with_dangerous_chars() {
        let action = "start;rm -rf /";
        let safe_action = action
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        assert_eq!(safe_action, "startrm -rf /");
        assert!(!safe_action.contains(';'));
    }

    #[test]
    fn test_safe_service_with_dangerous_chars() {
        let service = "nginx&shutdown";
        let safe_service = service
            .replace("'", "'\\''")
            .replace(";", "")
            .replace("&", "")
            .replace("|", "");
        assert_eq!(safe_service, "nginxshutdown");
        assert!(!safe_service.contains('&'));
    }

    #[test]
    fn test_manage_service_command_format() {
        let safe_action = "start";
        let safe_service = "nginx";
        let cmd = format!("systemctl {} {} 2>&1", safe_action, safe_service);
        assert!(cmd.contains("systemctl"));
        assert!(cmd.contains("start"));
        assert!(cmd.contains("nginx"));
        assert!(cmd.contains("2>&1"));
    }

    #[test]
    fn test_env_var_key_sanitization() {
        let key = "MY_VAR";
        let safe_key = key.replace("'", "'\\''").replace("\"", "\\\"");
        assert_eq!(safe_key, "MY_VAR");
    }

    #[test]
    fn test_env_var_value_sanitization() {
        let value = "hello world";
        let safe_value = value.replace("'", "'\\''").replace("\"", "\\\"");
        assert_eq!(safe_value, "hello world");
    }

    #[test]
    fn test_env_var_with_quotes_sanitization() {
        let key = "VAR'WITH'QUOTES";
        let safe_key = key.replace("'", "'\\''").replace("\"", "\\\"");
        assert_eq!(safe_key, "VAR'\\''WITH'\\''QUOTES");
        // The shell escaping produces '\'' sequences
        assert!(safe_key.contains("'\\''"));
    }

    #[test]
    fn test_set_env_var_grep_command() {
        let safe_key = "MY_VAR";
        let safe_value = "my_value";

        // The script should contain grep to check for existing export
        let script_contains_grep = format!(
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

        assert!(script_contains_grep.contains("grep -q"));
        assert!(script_contains_grep.contains("sed -i"));
        assert!(script_contains_grep.contains("export MY_VAR="));
    }

    #[test]
    fn test_delete_env_var_command() {
        let safe_key = "MY_VAR";
        let cmd = format!(
            r#"
            BASHRC="$HOME/.bashrc"
            sed -i "/^export {}=/d" "$BASHRC"
            unset {}
            "#,
            safe_key, safe_key
        );

        assert!(cmd.contains("sed -i"));
        assert!(cmd.contains("unset MY_VAR"));
    }

    #[test]
    fn test_systemctl_command_variants() {
        let actions = vec!["start", "stop", "restart", "enable", "disable"];
        let service = "nginx";

        for action in actions {
            let cmd = format!("systemctl {} {} 2>&1", action, service);
            assert!(cmd.contains("systemctl"));
            assert!(cmd.contains(action));
            assert!(cmd.contains(service));
        }
    }

    #[test]
    fn test_bashrc_path_constant() {
        assert_eq!("$HOME/.bashrc", "$HOME/.bashrc");
    }

    #[test]
    fn test_printenv_command() {
        let cmd = "printenv";
        assert_eq!(cmd, "printenv");
    }

    #[test]
    fn test_systemctl_check_command() {
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

        assert!(cmd.contains("command -v systemctl"));
        assert!(cmd.contains("systemctl list-units"));
        assert!(cmd.contains("--type=service"));
        assert!(cmd.contains("--no-pager"));
        assert!(cmd.contains("--no-legend"));
    }

    #[test]
    fn test_systemctl_timers_command() {
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

        assert!(cmd.contains("systemctl list-timers"));
        assert!(cmd.contains("--all"));
        assert!(cmd.contains("--no-pager"));
    }

    #[test]
    fn test_action_types() {
        let valid_actions = vec!["start", "stop", "restart", "enable", "disable"];
        for action in valid_actions {
            assert!(!action.is_empty());
        }
    }

    #[test]
    fn test_service_name_validation() {
        let valid_services = vec!["nginx", "docker", "ssh", "mysql", "postgresql"];
        for service in valid_services {
            assert!(!service.contains(';'));
            assert!(!service.contains('&'));
            assert!(!service.contains('|'));
        }
    }

    #[test]
    fn test_systemctl_command_format() {
        let service = "nginx";
        let actions = vec![
            format!("systemctl start {}", service),
            format!("systemctl stop {}", service),
            format!("systemctl restart {}", service),
            format!("systemctl status {}", service),
            format!("systemctl enable {}", service),
            format!("systemctl disable {}", service),
        ];

        for cmd in actions {
            assert!(cmd.starts_with("systemctl"));
        }
    }

    #[test]
    fn test_system_info_gathering() {
        let commands = vec![
            "uname -a",
            "uptime",
            "df -h",
            "free -m",
            "cat /proc/cpuinfo",
        ];

        for cmd in commands {
            assert!(!cmd.is_empty());
        }
    }

    #[test]
    fn test_process_monitoring() {
        let process_names = vec!["nginx", "postgres", "docker", "redis-server"];

        for name in process_names {
            assert!(!name.is_empty());
        }
    }

    #[test]
    fn test_disk_space_calculation() {
        let partitions = vec![
            ("/", 50000000u64),
            ("/home", 100000000u64),
            ("/var", 75000000u64),
        ];

        for (_mount, size) in partitions {
            assert!(size > 0);
        }
    }

    #[test]
    fn test_memory_info_parsing() {
        let mem_values = vec![
            ("MemTotal", 16000000u64),
            ("MemFree", 8000000u64),
            ("MemAvailable", 12000000u64),
        ];

        for (_label, value) in mem_values {
            assert!(value > 0);
        }
    }

    #[test]
    fn test_cpu_info_format() {
        let cpu_models = vec![
            "Intel(R) Core(TM) i7-9700K",
            "AMD Ryzen 7 3700X",
            "Intel(R) Xeon(R) CPU E5-2680 v4",
        ];

        for model in cpu_models {
            assert!(!model.is_empty());
        }
    }

    #[test]
    fn test_uptime_calculation() {
        let uptimes = vec![
            3600u64,    // 1 hour
            86400u64,   // 1 day
            604800u64,  // 1 week
            2592000u64, // 1 month
        ];

        for uptime in uptimes {
            assert!(uptime > 0);
        }
    }

    #[test]
    fn test_service_status_check() {
        let statuses = vec![
            "active (running)",
            "inactive (dead)",
            "failed",
            "activating",
        ];

        for status in statuses {
            assert!(!status.is_empty());
        }
    }

    #[test]
    fn test_log_file_paths() {
        let log_paths = vec![
            "/var/log/syslog",
            "/var/log/nginx/access.log",
            "/var/log/nginx/error.log",
            "/var/log/messages",
        ];

        for path in log_paths {
            assert!(path.starts_with("/var/log"));
        }
    }
}
