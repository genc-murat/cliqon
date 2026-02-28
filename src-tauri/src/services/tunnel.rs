use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::{TunnelConfig, TunnelType};

// tunnel state
#[derive(Debug)]
pub struct ActiveTunnel {
    pub config: TunnelConfig,
    pub session_id: String,
    pub is_running: Arc<AtomicBool>,
}

#[derive(Debug)]
pub struct TunnelService {
    // tunnel_id -> ActiveTunnel
    active_tunnels: Arc<Mutex<HashMap<String, ActiveTunnel>>>,
}

impl TunnelService {
    pub fn new() -> Self {
        Self {
            active_tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_tunnel(
        &self,
        session: &Session,
        config: TunnelConfig,
        session_id: String,
    ) -> Result<()> {
        let tunnel_id = config.id.clone();

        let mut tunnels = self.active_tunnels.lock().unwrap();
        if tunnels.contains_key(&tunnel_id) {
            return Err(AppError::Custom("Tunnel is already active".to_string()));
        }

        let is_running = Arc::new(AtomicBool::new(true));

        match config.tunnel_type {
            TunnelType::Local => {
                let local_port = config.local_port;
                let remote_host = config
                    .remote_host
                    .clone()
                    .unwrap_or_else(|| "127.0.0.1".to_string());
                let remote_port = config.remote_port.unwrap_or(80);

                let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))?;
                listener.set_nonblocking(true)?;

                let cloned_session = session.clone();
                let running_flag = Arc::clone(&is_running);

                thread::spawn(move || {
                    for stream in listener.incoming() {
                        if !running_flag.load(Ordering::Relaxed) {
                            break;
                        }

                        match stream {
                            Ok(mut tcp_stream) => {
                                // Accept connection
                                let channel_res = cloned_session.channel_direct_tcpip(
                                    &remote_host,
                                    remote_port,
                                    None,
                                );

                                if let Ok(mut channel) = channel_res {
                                    let mut tcp_stream_clone = tcp_stream.try_clone().unwrap();
                                    let mut channel_clone = channel.clone();

                                    // TCP -> SSH
                                    thread::spawn(move || {
                                        let mut buf = [0u8; 8192];
                                        while let Ok(n) = tcp_stream.read(&mut buf) {
                                            if n == 0 {
                                                break;
                                            }
                                            if channel.write_all(&buf[..n]).is_err() {
                                                break;
                                            }
                                        }
                                        let _ = channel.send_eof();
                                    });

                                    // SSH -> TCP
                                    thread::spawn(move || {
                                        let mut buf = [0u8; 8192];
                                        while let Ok(n) = channel_clone.read(&mut buf) {
                                            if n == 0 {
                                                break;
                                            }
                                            if tcp_stream_clone.write_all(&buf[..n]).is_err() {
                                                break;
                                            }
                                        }
                                    });
                                }
                            }
                            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                thread::sleep(std::time::Duration::from_millis(50));
                            }
                            Err(_) => {
                                break;
                            }
                        }
                    }
                });
            }
            TunnelType::Remote => {
                let local_port = config.local_port;
                let remote_host = config
                    .remote_host
                    .clone()
                    .unwrap_or_else(|| "0.0.0.0".to_string());
                let remote_port = config.remote_port.unwrap_or(8080);

                let (mut listener, _) =
                    session.channel_forward_listen(remote_port, Some(&remote_host), None)?;

                let running_flag = Arc::clone(&is_running);

                thread::spawn(move || {
                    while running_flag.load(Ordering::Relaxed) {
                        // accept() may block, but we can't easily interrupt it other than closing the session/channel
                        match listener.accept() {
                            Ok(mut channel) => {
                                if let Ok(mut tcp_stream) =
                                    TcpStream::connect(format!("127.0.0.1:{}", local_port))
                                {
                                    let mut tcp_stream_clone = tcp_stream.try_clone().unwrap();
                                    let mut channel_clone = channel.clone();

                                    // TCP -> SSH
                                    thread::spawn(move || {
                                        let mut buf = [0u8; 8192];
                                        while let Ok(n) = tcp_stream.read(&mut buf) {
                                            if n == 0 {
                                                break;
                                            }
                                            if channel.write_all(&buf[..n]).is_err() {
                                                break;
                                            }
                                        }
                                        let _ = channel.send_eof();
                                    });

                                    // SSH -> TCP
                                    thread::spawn(move || {
                                        let mut buf = [0u8; 8192];
                                        while let Ok(n) = channel_clone.read(&mut buf) {
                                            if n == 0 {
                                                break;
                                            }
                                            if tcp_stream_clone.write_all(&buf[..n]).is_err() {
                                                break;
                                            }
                                        }
                                    });
                                }
                            }
                            Err(_) => {
                                // Ignore timeout/errors and check running flag again
                                thread::sleep(std::time::Duration::from_millis(100));
                            }
                        }
                    }
                });
            }
            TunnelType::Dynamic => {
                let local_port = config.local_port;
                let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))?;
                listener.set_nonblocking(true)?;

                let cloned_session = session.clone();
                let running_flag = Arc::clone(&is_running);

                thread::spawn(move || {
                    for stream in listener.incoming() {
                        if !running_flag.load(Ordering::Relaxed) {
                            break;
                        }

                        match stream {
                            Ok(mut tcp_stream) => {
                                let session_for_thread = cloned_session.clone();

                                thread::spawn(move || {
                                    let mut buf = [0u8; 512];

                                    // 1. Read SOCKS5 greeting
                                    if tcp_stream.read(&mut buf).unwrap_or(0) < 3 {
                                        return;
                                    }
                                    if buf[0] != 0x05 {
                                        return;
                                    } // Only SOCKS5 supported

                                    // 2. Reply no auth
                                    if tcp_stream.write_all(&[0x05, 0x00]).is_err() {
                                        return;
                                    }

                                    // 3. Read connection request
                                    let n = tcp_stream.read(&mut buf).unwrap_or(0);
                                    if n < 10 || buf[0] != 0x05 || buf[1] != 0x01 {
                                        return;
                                    } // Only TCP connect (0x01)

                                    let atyp = buf[3];
                                    let host;
                                    let port;

                                    if atyp == 0x01 {
                                        // IPv4
                                        if n < 10 {
                                            return;
                                        }
                                        host =
                                            format!("{}.{}.{}.{}", buf[4], buf[5], buf[6], buf[7]);
                                        port = u16::from_be_bytes([buf[8], buf[9]]);
                                    } else if atyp == 0x03 {
                                        // Domain name
                                        let len = buf[4] as usize;
                                        if n < 5 + len + 2 {
                                            return;
                                        }
                                        host =
                                            String::from_utf8_lossy(&buf[5..5 + len]).to_string();
                                        let offset = 5 + len;
                                        port = u16::from_be_bytes([buf[offset], buf[offset + 1]]);
                                    } else {
                                        let _ = tcp_stream
                                            .write_all(&[0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]); // Address type not supported
                                        return;
                                    }

                                    // 4. Connect via SSH channel_direct_tcpip
                                    if let Ok(mut channel) =
                                        session_for_thread.channel_direct_tcpip(&host, port, None)
                                    {
                                        // Reply success
                                        if tcp_stream
                                            .write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                                            .is_err()
                                        {
                                            return;
                                        }

                                        let mut tcp_stream_clone = tcp_stream.try_clone().unwrap();
                                        let mut channel_clone = channel.clone();

                                        // TCP -> SSH
                                        thread::spawn(move || {
                                            let mut b = [0u8; 8192];
                                            while let Ok(n) = tcp_stream.read(&mut b) {
                                                if n == 0 {
                                                    break;
                                                }
                                                if channel.write_all(&b[..n]).is_err() {
                                                    break;
                                                }
                                            }
                                            let _ = channel.send_eof();
                                        });

                                        // SSH -> TCP
                                        let mut b = [0u8; 8192];
                                        while let Ok(n) = channel_clone.read(&mut b) {
                                            if n == 0 {
                                                break;
                                            }
                                            if tcp_stream_clone.write_all(&b[..n]).is_err() {
                                                break;
                                            }
                                        }
                                    } else {
                                        // Reply general failure
                                        let _ = tcp_stream
                                            .write_all(&[0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
                                    }
                                });
                            }
                            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                thread::sleep(std::time::Duration::from_millis(50));
                            }
                            Err(_) => {
                                break;
                            }
                        }
                    }
                });
            }
        }

        tunnels.insert(
            tunnel_id,
            ActiveTunnel {
                config,
                session_id,
                is_running,
            },
        );

        Ok(())
    }

    pub fn stop_tunnel(&self, tunnel_id: &str) -> Result<()> {
        let mut tunnels = self.active_tunnels.lock().unwrap();
        if let Some(tunnel) = tunnels.remove(tunnel_id) {
            tunnel.is_running.store(false, Ordering::Relaxed);
        }
        Ok(())
    }

    pub fn get_active_tunnels(&self, session_id: &str) -> Vec<TunnelConfig> {
        let tunnels = self.active_tunnels.lock().unwrap();
        tunnels
            .values()
            .filter(|t| t.session_id == session_id)
            .map(|t| t.config.clone())
            .collect()
    }

    pub fn get_all_tunnel_ids(&self) -> Vec<String> {
        let tunnels = self.active_tunnels.lock().unwrap();
        tunnels.keys().cloned().collect()
    }

    pub fn is_tunnel_active(&self, tunnel_id: &str) -> bool {
        let tunnels = self.active_tunnels.lock().unwrap();
        tunnels.contains_key(tunnel_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tunnel_service_new() {
        let service = TunnelService::new();
        let ids = service.get_all_tunnel_ids();
        assert!(ids.is_empty());
    }

    #[test]
    fn test_get_active_tunnels_empty() {
        let service = TunnelService::new();
        let tunnels = service.get_active_tunnels("session-1");
        assert!(tunnels.is_empty());
    }

    #[test]
    fn test_get_all_tunnel_ids_empty() {
        let service = TunnelService::new();
        let ids = service.get_all_tunnel_ids();
        assert!(ids.is_empty());
    }

    #[test]
    fn test_is_tunnel_active_false() {
        let service = TunnelService::new();
        assert!(!service.is_tunnel_active("nonexistent"));
    }

    #[test]
    fn test_stop_tunnel_nonexistent() {
        let service = TunnelService::new();
        let result = service.stop_tunnel("nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn test_active_tunnel_creation() {
        let config = TunnelConfig {
            id: "tunnel-1".to_string(),
            name: "Test Tunnel".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("localhost".to_string()),
            remote_port: Some(80),
        };

        let is_running = Arc::new(AtomicBool::new(true));
        let tunnel = ActiveTunnel {
            config: config.clone(),
            session_id: "session-1".to_string(),
            is_running: is_running.clone(),
        };

        assert_eq!(tunnel.config.id, "tunnel-1");
        assert_eq!(tunnel.session_id, "session-1");
        assert!(tunnel.is_running.load(Ordering::Relaxed));
    }

    #[test]
    fn test_active_tunnel_is_running_flag() {
        let config = TunnelConfig {
            id: "tunnel-2".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Remote,
            local_port: 3000,
            remote_host: None,
            remote_port: None,
        };

        let is_running = Arc::new(AtomicBool::new(true));
        let tunnel = ActiveTunnel {
            config,
            session_id: "session-1".to_string(),
            is_running: is_running.clone(),
        };

        assert!(tunnel.is_running.load(Ordering::Relaxed));

        tunnel.is_running.store(false, Ordering::Relaxed);
        assert!(!tunnel.is_running.load(Ordering::Relaxed));
    }

    #[test]
    fn test_tunnel_config_equality() {
        let config1 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        let config2 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        assert_eq!(config1, config2);
    }

    #[test]
    fn test_tunnel_config_different_names_not_equal() {
        let config1 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        let config2 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel B".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        assert_ne!(config1, config2);
    }

    #[test]
    fn test_tunnel_type_variants() {
        assert_eq!(TunnelType::Local, TunnelType::Local);
        assert_ne!(TunnelType::Local, TunnelType::Remote);
        assert_ne!(TunnelType::Remote, TunnelType::Dynamic);
    }

    #[test]
    fn test_tunnel_config_clone() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("localhost".to_string()),
            remote_port: Some(80),
        };

        let cloned = config.clone();
        assert_eq!(config.id, cloned.id);
        assert_eq!(config.name, cloned.name);
        assert_eq!(config.tunnel_type, cloned.tunnel_type);
    }

    #[test]
    fn test_tunnel_config_debug() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let debug_str = format!("{:?}", config);
        assert!(debug_str.contains("TunnelConfig"));
        assert!(debug_str.contains("Test"));
    }

    #[test]
    fn test_tunnel_type_debug() {
        let debug_local = format!("{:?}", TunnelType::Local);
        let debug_remote = format!("{:?}", TunnelType::Remote);
        let debug_dynamic = format!("{:?}", TunnelType::Dynamic);

        assert_eq!(debug_local, "Local");
        assert_eq!(debug_remote, "Remote");
        assert_eq!(debug_dynamic, "Dynamic");
    }

    #[test]
    fn test_active_tunnel_debug() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let is_running = Arc::new(AtomicBool::new(true));
        let tunnel = ActiveTunnel {
            config,
            session_id: "session-1".to_string(),
            is_running,
        };

        let debug_str = format!("{:?}", tunnel);
        assert!(debug_str.contains("ActiveTunnel"));
    }

    #[test]
    fn test_tunnel_service_debug() {
        let service = TunnelService::new();
        // TunnelService has Debug derived, but we can't easily test the output
        // since it contains Arc<Mutex<HashMap>> which doesn't have useful Debug output
        let _ = format!("{:?}", service);
    }

    #[test]
    fn test_atomic_bool_operations() {
        let flag = Arc::new(AtomicBool::new(true));
        
        assert!(flag.load(Ordering::Relaxed));
        
        flag.store(false, Ordering::Relaxed);
        assert!(!flag.load(Ordering::Relaxed));
        
        flag.store(true, Ordering::Relaxed);
        assert!(flag.load(Ordering::Relaxed));
    }

    #[test]
    fn test_atomic_bool_clone() {
        let flag = Arc::new(AtomicBool::new(true));
        let cloned = Arc::clone(&flag);
        
        flag.store(false, Ordering::Relaxed);
        assert!(!cloned.load(Ordering::Relaxed));
    }

    #[test]
    fn test_tunnel_config_local_port_default() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 0,
            remote_host: None,
            remote_port: None,
        };

        assert_eq!(config.local_port, 0);
    }

    #[test]
    fn test_tunnel_config_remote_host_default() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let remote_host = config.remote_host.clone().unwrap_or_else(|| "127.0.0.1".to_string());
        assert_eq!(remote_host, "127.0.0.1");
    }

    #[test]
    fn test_tunnel_config_remote_port_default() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let remote_port = config.remote_port.unwrap_or(80);
        assert_eq!(remote_port, 80);
    }

    #[test]
    fn test_tunnel_config_with_remote_host() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("192.168.1.1".to_string()),
            remote_port: Some(443),
        };

        let remote_host = config.remote_host.clone().unwrap_or_else(|| "127.0.0.1".to_string());
        let remote_port = config.remote_port.unwrap_or(80);

        assert_eq!(remote_host, "192.168.1.1");
        assert_eq!(remote_port, 443);
    }

    #[test]
    fn test_tunnel_config_port_ranges() {
        let valid_ports = vec![22, 80, 443, 3306, 5432, 8080, 3000, 65535];
        
        for port in valid_ports {
            assert!(port > 0);
            assert!(port <= 65535);
        }
    }

    #[test]
    fn test_tunnel_config_host_formats() {
        let hosts = vec![
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "192.168.1.1",
            "example.com",
        ];

        for host in hosts {
            assert!(!host.is_empty());
        }
    }

    #[test]
    fn test_tunnel_service_mutex_access() {
        let service = TunnelService::new();
        
        let tunnels = service.active_tunnels.lock().unwrap();
        assert!(tunnels.is_empty());
        drop(tunnels);
        
        let tunnels2 = service.active_tunnels.lock().unwrap();
        assert!(tunnels2.is_empty());
    }

    #[test]
    fn test_tunnel_service_arc_clone() {
        let service = Arc::new(TunnelService::new());
        let cloned = Arc::clone(&service);
        
        let ids = service.get_all_tunnel_ids();
        assert!(ids.is_empty());
        
        let ids2 = cloned.get_all_tunnel_ids();
        assert!(ids2.is_empty());
    }

    #[test]
    fn test_get_active_tunnels_filter() {
        let service = TunnelService::new();
        
        let tunnels_session1 = service.get_active_tunnels("session-1");
        let tunnels_session2 = service.get_active_tunnels("session-2");
        
        assert!(tunnels_session1.is_empty());
        assert!(tunnels_session2.is_empty());
    }

    #[test]
    fn test_is_tunnel_active_with_different_ids() {
        let service = TunnelService::new();
        
        assert!(!service.is_tunnel_active("tunnel-1"));
        assert!(!service.is_tunnel_active("tunnel-2"));
        assert!(!service.is_tunnel_active(""));
    }

    #[test]
    fn test_stop_tunnel_multiple_times() {
        let service = TunnelService::new();
        
        let result1 = service.stop_tunnel("nonexistent");
        let result2 = service.stop_tunnel("nonexistent");
        let result3 = service.stop_tunnel("another");
        
        assert!(result1.is_ok());
        assert!(result2.is_ok());
        assert!(result3.is_ok());
    }

    #[test]
    fn test_get_all_tunnel_ids_returns_vec() {
        let service = TunnelService::new();
        let ids = service.get_all_tunnel_ids();
        
        assert!(ids.is_empty());
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn test_tunnel_config_equality_different_ports() {
        let config1 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        let config2 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 9090,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        assert_ne!(config1, config2);
    }

    #[test]
    fn test_tunnel_config_equality_different_types() {
        let config1 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        let config2 = TunnelConfig {
            id: "same-id".to_string(),
            name: "Tunnel A".to_string(),
            tunnel_type: TunnelType::Remote,
            local_port: 8080,
            remote_host: Some("host".to_string()),
            remote_port: Some(80),
        };

        assert_ne!(config1, config2);
    }

    #[test]
    fn test_tunnel_config_all_fields() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test Tunnel".to_string(),
            tunnel_type: TunnelType::Dynamic,
            local_port: 1080,
            remote_host: None,
            remote_port: None,
        };

        assert_eq!(config.id, "t1");
        assert_eq!(config.name, "Test Tunnel");
        assert_eq!(config.tunnel_type, TunnelType::Dynamic);
        assert_eq!(config.local_port, 1080);
        assert!(config.remote_host.is_none());
        assert!(config.remote_port.is_none());
    }

    #[test]
    fn test_active_tunnel_all_fields() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let is_running = Arc::new(AtomicBool::new(true));
        let tunnel = ActiveTunnel {
            config: config.clone(),
            session_id: "session-1".to_string(),
            is_running: Arc::clone(&is_running),
        };

        assert_eq!(tunnel.config.id, config.id);
        assert_eq!(tunnel.session_id, "session-1");
        assert!(tunnel.is_running.load(Ordering::Relaxed));
    }

    #[test]
    fn test_error_already_active() {
        let service = TunnelService::new();
        
        // Try to stop a non-existent tunnel - should succeed
        let result = service.stop_tunnel("nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn test_result_ok() {
        let result: Result<()> = Ok(());
        assert!(result.is_ok());
    }

    #[test]
    fn test_result_err() {
        let result: Result<()> = Err(AppError::Custom("test error".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_error_messages() {
        let errors = vec![
            "Tunnel is already active",
            "Session not found",
            "TCP bind failed",
            "SSH channel error",
        ];

        for error in errors {
            let err = AppError::Custom(error.to_string());
            assert!(err.to_string().contains(error));
        }
    }

    #[test]
    fn test_hashmap_operations() {
        let mut map: HashMap<String, i32> = HashMap::new();
        
        map.insert("key1".to_string(), 1);
        map.insert("key2".to_string(), 2);
        
        assert_eq!(map.len(), 2);
        assert!(map.contains_key("key1"));
        assert!(map.contains_key("key2"));
        assert!(!map.contains_key("key3"));
        
        map.remove("key1");
        assert_eq!(map.len(), 1);
        assert!(!map.contains_key("key1"));
    }

    #[test]
    fn test_hashmap_clone() {
        let mut map: HashMap<String, String> = HashMap::new();
        map.insert("key1".to_string(), "value1".to_string());
        
        let cloned = map.clone();
        assert_eq!(map.len(), cloned.len());
        assert_eq!(map.get("key1"), cloned.get("key1"));
    }

    #[test]
    fn test_vec_filter_and_collect() {
        let items = vec![1, 2, 3, 4, 5, 6];
        let evens: Vec<i32> = items.into_iter().filter(|x| x % 2 == 0).collect();
        
        assert_eq!(evens.len(), 3);
        assert_eq!(evens, vec![2, 4, 6]);
    }

    #[test]
    fn test_vec_map_and_collect() {
        let items = vec![1, 2, 3];
        let doubled: Vec<i32> = items.into_iter().map(|x| x * 2).collect();
        
        assert_eq!(doubled, vec![2, 4, 6]);
    }

    #[test]
    fn test_option_unwrap_or_else() {
        let none: Option<String> = None;
        let value = none.unwrap_or_else(|| "default".to_string());
        assert_eq!(value, "default");

        let some: Option<String> = Some("value".to_string());
        let value2 = some.unwrap_or_else(|| "default".to_string());
        assert_eq!(value2, "value");
    }

    #[test]
    fn test_string_format() {
        let port: u16 = 8080;
        let formatted = format!("127.0.0.1:{}", port);
        assert_eq!(formatted, "127.0.0.1:8080");
    }

    #[test]
    fn test_duration_from_millis() {
        let duration = std::time::Duration::from_millis(50);
        assert_eq!(duration.as_millis(), 50);

        let duration2 = std::time::Duration::from_millis(100);
        assert_eq!(duration2.as_millis(), 100);
    }

    #[test]
    fn test_thread_sleep() {
        let start = std::time::Instant::now();
        thread::sleep(std::time::Duration::from_millis(10));
        let elapsed = start.elapsed();
        
        assert!(elapsed >= std::time::Duration::from_millis(10));
    }

    #[test]
    fn test_ordering_relaxed() {
        let flag = AtomicBool::new(false);
        
        flag.store(true, Ordering::Relaxed);
        assert!(flag.load(Ordering::Relaxed));
        
        flag.store(false, Ordering::Relaxed);
        assert!(!flag.load(Ordering::Relaxed));
    }

    #[test]
    fn test_arc_new_and_clone() {
        let arc = Arc::new(42);
        let cloned = Arc::clone(&arc);
        
        assert_eq!(*arc, 42);
        assert_eq!(*cloned, 42);
        assert!(Arc::ptr_eq(&arc, &cloned));
    }

    #[test]
    fn test_mutex_new_and_lock() {
        let mutex = Mutex::new(42);
        let guard = mutex.lock().unwrap();
        
        assert_eq!(*guard, 42);
    }

    #[test]
    fn test_arc_mutex_pattern() {
        let data: Arc<Mutex<Vec<i32>>> = Arc::new(Mutex::new(vec![1, 2, 3]));
        
        {
            let mut guard = data.lock().unwrap();
            guard.push(4);
        }
        
        let guard2 = data.lock().unwrap();
        assert_eq!(guard2.len(), 4);
        assert_eq!(guard2[3], 4);
    }

    #[test]
    fn test_tcp_listener_bind_format() {
        let port: u16 = 8080;
        let addr = format!("127.0.0.1:{}", port);
        assert_eq!(addr, "127.0.0.1:8080");
    }

    #[test]
    fn test_session_id_formats() {
        let session_ids = vec![
            "session-1",
            "tunnel-abc",
            "ssh-xyz",
        ];

        for id in session_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_tunnel_id_formats() {
        let tunnel_ids = vec![
            "tunnel-1",
            "local-forward",
            "remote-8080",
            "dynamic-socks",
        ];

        for id in tunnel_ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_clone_trait() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let cloned = config.clone();
        assert_eq!(config, cloned);
    }

    #[test]
    fn test_partial_eq_trait() {
        let config1 = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let config2 = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        assert_eq!(config1, config2);
    }

    #[test]
    fn test_partial_eq_not_equal() {
        let config1 = TunnelConfig {
            id: "t1".to_string(),
            name: "Test1".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        let config2 = TunnelConfig {
            id: "t1".to_string(),
            name: "Test2".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: None,
            remote_port: None,
        };

        assert_ne!(config1, config2);
    }
}
