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
pub struct ActiveTunnel {
    pub config: TunnelConfig,
    pub session_id: String,
    pub is_running: Arc<AtomicBool>,
}

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
}
