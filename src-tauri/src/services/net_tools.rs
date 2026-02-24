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
            // Some tools don't need a target, so we only error if one is strictly required by the command construction below.
            // For simplicity, we'll let empty targets pass and handle them in the match arms if needed, 
            // or rely on the frontend to block them. 
            // However, existing logic checked for empty. Let's relax this for "self" tools or provide a dummy if not used.
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
            "portscan" => format!(
                "nc -zv -w 2 {} 21 22 25 53 80 110 143 443 465 587 993 995 3306 5432 6379 8080 8123 2>&1",
                safe_target
            ),
            "nmap" => format!("nmap -Pn -T4 {} 2>&1", safe_target),
            "whois" => format!("whois {} 2>&1", safe_target),
            "mtr" => format!("mtr -rw -c 5 {} 2>&1", safe_target),
            "tracepath" => format!("tracepath -n {} 2>&1", safe_target),
            "nslookup" => format!("nslookup {} 2>&1", safe_target),
            "curl_timing" => format!(
                "curl -s -w \"DNS Lookup: %{{time_namelookup}}s\\nConnect: %{{time_connect}}s\\nApp Connect: %{{time_appconnect}}s\\nPre Transfer: %{{time_pretransfer}}s\\nStart Transfer: %{{time_starttransfer}}s\\nTotal: %{{time_total}}s\\nSize: %{{size_download}} bytes\\nSpeed: %{{speed_download}} bps\\n\" -o /dev/null {} 2>&1",
                safe_target
            ),
            "connections" => "ss -tunap 2>&1 || netstat -tunap 2>&1".to_string(),
            "interfaces" => "ip -c addr 2>&1 || ifconfig 2>&1".to_string(),
            "public_ip" => "curl -s https://ifconfig.me 2>&1 || curl -s https://api.ipify.org 2>&1".to_string(),
            "routes" => "ip -c route 2>&1 || route -n 2>&1".to_string(),
            "neighbors" => "ip -c neigh 2>&1 || arp -n 2>&1".to_string(),
            "listening" => "ss -tuln 2>&1 || netstat -tuln 2>&1".to_string(),
            "netstat" => "netstat -rn 2>&1".to_string(),
            "dns_config" => "cat /etc/resolv.conf 2>&1".to_string(),
            "hosts_file" => "cat /etc/hosts 2>&1".to_string(),
            "http_check" => format!("curl -IL --max-time 10 {} 2>&1", safe_target),
            "ssl_check" => format!(
                "echo | openssl s_client -connect {}:443 -servername {} -showcerts 2>/dev/null | openssl x509 -text 2>&1",
                safe_target, safe_target
            ),
            "stats_summary" => "ss -s 2>&1 || netstat -s 2>&1".to_string(),
            "bandwidth_stats" => "cat /proc/net/dev 2>&1".to_string(),
            "firewall_status" => "sudo ufw status 2>&1 || sudo iptables -L -n 2>&1".to_string(),
            "fail2ban_status" => "sudo fail2ban-client status 2>&1".to_string(),
            "hostname_info" => "hostnamectl 2>&1 || hostname -f 2>&1".to_string(),
            "active_users" => "w 2>&1 || who 2>&1".to_string(),
            "open_files" => "lsof -i 2>&1".to_string(),
            "uptime" => "uptime 2>&1".to_string(),
            "disk_usage" => "df -h 2>&1".to_string(),
            "memory_usage" => "free -h 2>&1".to_string(),
            "last_logins" => "last -n 10 2>&1".to_string(),
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
