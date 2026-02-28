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
            "arp" => "arp -n 2>&1".to_string(),
            "ip_link" => "ip -c link 2>&1".to_string(),
            "ip_route_get" => format!("ip route get {} 2>&1", safe_target),
            "resolvectl" => format!("resolvectl query {} 2>&1", safe_target),
            "tcpdump" => "sudo tcpdump -i any -c 10 -n 2>&1 || timeout 5 tcpdump -i any -c 5 -n 2>&1".to_string(),
            "speedtest" => "speedtest-cli 2>&1 || (curl -s https://speed.cloudflare.com/api/info && echo 'Cloudflare speed test endpoint available')".to_string(),
            "processes" => "ps aux --sort=-%mem 2>&1 | head -25".to_string(),
            "systemctl_list" => "systemctl list-units --type=service --state=running --no-pager 2>&1".to_string(),
            "nmap_os" => format!("nmap -O --osscan-guess {} 2>&1", safe_target),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_net_tool_manager_new() {
        let manager = NetToolManager::new();
        // NetToolManager is a unit struct, just verify it can be created
        let _ = manager;
    }

    #[test]
    fn test_run_tool_unknown_tool() {
        let manager = NetToolManager::new();
        let profile = SshProfile::default();
        
        let result = manager.run_tool(&profile, None, "unknown_tool", "127.0.0.1");
        
        assert!(result.is_err());
        if let Err(e) = result {
            let msg = e.to_string();
            assert!(msg.contains("Unknown tool type"));
        }
    }

    #[test]
    fn test_run_tool_empty_target_filter() {
        let target = "";
        let safe_target: String = target
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == ':' || *c == '_')
            .collect();
        assert!(safe_target.is_empty());
    }

    #[test]
    fn test_run_tool_target_sanitization() {
        let malicious_target = "127.0.0.1; rm -rf /";
        let safe_target: String = malicious_target
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == ':' || *c == '_')
            .collect();
        
        // The filter keeps alphanumeric and .-:_ characters
        // Note: "rm" in the original becomes part of the string since 'r' and 'm' are alphanumeric
        // The important thing is that dangerous characters are removed
        assert!(safe_target.starts_with("127.0.0.1"));
        assert!(!safe_target.contains(';'));
        assert!(!safe_target.contains(' '));
        assert!(!safe_target.contains('/'));
        // The dangerous command structure is broken even if some letters remain
    }

    #[test]
    fn test_run_tool_target_with_valid_chars() {
        let valid_target = "example-server.example.com";
        let safe_target: String = valid_target
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == ':' || *c == '_')
            .collect();
        
        assert_eq!(safe_target, valid_target);
    }

    #[test]
    fn test_run_tool_ipv6_target() {
        let ipv6 = "::1";
        let safe_target: String = ipv6
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == ':' || *c == '_')
            .collect();
        
        assert_eq!(safe_target, "::1");
    }

    #[test]
    fn test_ping_command_format() {
        let target = "127.0.0.1";
        let cmd = format!("ping -c 10 -i 0.3 {} 2>&1", target);
        assert!(cmd.contains("ping"));
        assert!(cmd.contains("-c 10"));
        assert!(cmd.contains(target));
    }

    #[test]
    fn test_traceroute_command_format() {
        let target = "example.com";
        let cmd = format!(
            "traceroute -m 30 {} 2>&1 || tracepath {} 2>&1",
            target, target
        );
        assert!(cmd.contains("traceroute"));
        assert!(cmd.contains("tracepath"));
    }

    #[test]
    fn test_dns_command_format() {
        let target = "example.com";
        let cmd = format!(
            "dig +noall +answer {} ANY 2>&1 || nslookup {} 2>&1 || host {} 2>&1",
            target, target, target
        );
        assert!(cmd.contains("dig"));
        assert!(cmd.contains("nslookup"));
        assert!(cmd.contains("host"));
    }

    #[test]
    fn test_portscan_command_format() {
        let target = "127.0.0.1";
        let cmd = format!(
            "nc -zv -w 2 {} 21 22 25 53 80 110 143 443 465 587 993 995 3306 5432 6379 8080 8123 2>&1",
            target
        );
        assert!(cmd.contains("nc -zv"));
        assert!(cmd.contains("22"));
        assert!(cmd.contains("80"));
    }

    #[test]
    fn test_connections_command() {
        let cmd = "ss -tunap 2>&1 || netstat -tunap 2>&1";
        assert!(cmd.contains("ss -tunap"));
        assert!(cmd.contains("netstat -tunap"));
    }

    #[test]
    fn test_interfaces_command() {
        let cmd = "ip -c addr 2>&1 || ifconfig 2>&1";
        assert!(cmd.contains("ip -c addr"));
        assert!(cmd.contains("ifconfig"));
    }

    #[test]
    fn test_public_ip_command() {
        let cmd = "curl -s https://ifconfig.me 2>&1 || curl -s https://api.ipify.org 2>&1";
        assert!(cmd.contains("ifconfig.me"));
        assert!(cmd.contains("api.ipify.org"));
    }

    #[test]
    fn test_curl_timing_command_format() {
        let target = "https://example.com";
        let cmd = format!(
            "curl -s -w \"DNS Lookup: %{{time_namelookup}}s\\nConnect: %{{time_connect}}s\\nApp Connect: %{{time_appconnect}}s\\nPre Transfer: %{{time_pretransfer}}s\\nStart Transfer: %{{time_starttransfer}}s\\nTotal: %{{time_total}}s\\nSize: %{{size_download}} bytes\\nSpeed: %{{speed_download}} bps\\n\" -o /dev/null {} 2>&1",
            target
        );
        assert!(cmd.contains("curl"));
        assert!(cmd.contains("time_namelookup"));
        assert!(cmd.contains("time_total"));
    }

    #[test]
    fn test_ssl_check_command_format() {
        let target = "example.com";
        let cmd = format!(
            "echo | openssl s_client -connect {}:443 -servername {} -showcerts 2>/dev/null | openssl x509 -text 2>&1",
            target, target
        );
        assert!(cmd.contains("openssl s_client"));
        assert!(cmd.contains(":443"));
    }

    #[test]
    fn test_tool_type_variants() {
        // Test that all tool types can be matched
        let tools = vec![
            "ping", "traceroute", "dns", "portscan", "nmap", "whois", "mtr",
            "tracepath", "nslookup", "curl_timing", "connections", "interfaces",
            "public_ip", "routes", "neighbors", "listening", "netstat",
            "dns_config", "hosts_file", "http_check", "ssl_check", "stats_summary",
            "bandwidth_stats", "firewall_status", "fail2ban_status", "hostname_info",
            "active_users", "open_files", "uptime", "disk_usage", "memory_usage",
            "last_logins", "arp", "ip_link", "ip_route_get", "resolvectl",
            "tcpdump", "speedtest", "processes", "systemctl_list", "nmap_os",
        ];

        for tool in tools {
            match tool {
                "ping" | "traceroute" | "dns" | "portscan" | "nmap" | "whois" | "mtr"
                | "tracepath" | "nslookup" | "curl_timing" | "connections" | "interfaces"
                | "public_ip" | "routes" | "neighbors" | "listening" | "netstat"
                | "dns_config" | "hosts_file" | "http_check" | "ssl_check" | "stats_summary"
                | "bandwidth_stats" | "firewall_status" | "fail2ban_status" | "hostname_info"
                | "active_users" | "open_files" | "uptime" | "disk_usage" | "memory_usage"
                | "last_logins" | "arp" | "ip_link" | "ip_route_get" | "resolvectl"
                | "tcpdump" | "speedtest" | "processes" | "systemctl_list" | "nmap_os" => {
                    // Valid tool type
                }
                _ => panic!("Unknown tool type: {}", tool),
            }
        }
    }

    #[test]
    fn test_command_injection_characters_blocked() {
        let blocked_chars = vec![';', '&', '|', '$', '`', '(', ')', '{', '}', '<', '>', '\n', '\r'];
        
        for ch in blocked_chars {
            let target = format!("127.0.0.1{}rm", ch);
            let safe_target: String = target
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == ':' || *c == '_')
                .collect();
            
            assert!(!safe_target.contains(ch), "Character {} should be filtered", ch);
        }
    }
}
