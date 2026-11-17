use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, Ipv6Addr, Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use ssh2::{Channel, Listener, Session};

use super::{auth::authenticate_session, connection_stop::ConnectionStop, host_keys};
use crate::error::{AppError, Result};
use crate::models::profile::{SshProfile, TunnelConfig, TunnelType};

const POLL_INTERVAL: Duration = Duration::from_millis(15);
const FORWARD_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone)]
pub struct ActiveTunnel {
    pub config: TunnelConfig,
    pub session_id: String,
    pub is_running: Arc<AtomicBool>,
    pub bytes_sent: Arc<AtomicU64>,
    pub bytes_received: Arc<AtomicU64>,
    stop: Arc<ConnectionStop>,
}

impl ActiveTunnel {
    fn running(&self) -> bool {
        self.is_running.load(Ordering::Acquire)
    }

    fn cancel(&self) {
        self.is_running.store(false, Ordering::Release);
        self.stop.cancel();
    }
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct TunnelStats {
    pub tunnel_id: String,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub is_active: bool,
}

#[derive(Clone, Default)]
pub struct TunnelService {
    active_tunnels: Arc<Mutex<HashMap<String, ActiveTunnel>>>,
}

enum ForwardListener {
    Local(TcpListener),
    Remote(Listener),
}

impl TunnelService {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start_tunnel(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        config: TunnelConfig,
        session_id: String,
        session_stop: &ConnectionStop,
    ) -> Result<()> {
        let tunnel = ActiveTunnel {
            config,
            session_id,
            is_running: Arc::new(AtomicBool::new(true)),
            bytes_sent: Arc::new(AtomicU64::new(0)),
            bytes_received: Arc::new(AtomicU64::new(0)),
            stop: Arc::new(ConnectionStop::default()),
        };
        {
            let mut tunnels = self.active_tunnels.lock().unwrap();
            if session_stop.is_cancelled() {
                return Err(AppError::Custom("SSH session closed".into()));
            }
            if tunnels.contains_key(&tunnel.config.id) {
                return Err(AppError::Custom("Tunnel is already active".into()));
            }
            tunnels.insert(tunnel.config.id.clone(), tunnel.clone());
        }

        let setup = (|| {
            let stream = host_keys::connect_tcp(profile)?;
            tunnel.stop.attach(&stream)?;
            let mut session = host_keys::handshake(stream)?;
            authenticate_session(&mut session, profile, secret)?;

            let listener = match tunnel.config.tunnel_type {
                TunnelType::Local | TunnelType::Dynamic => {
                    let listener =
                        TcpListener::bind((Ipv4Addr::LOCALHOST, tunnel.config.local_port))?;
                    listener.set_nonblocking(true)?;
                    ForwardListener::Local(listener)
                }
                TunnelType::Remote => {
                    let (listener, _) = session.channel_forward_listen(
                        tunnel.config.remote_port.unwrap_or(8080),
                        Some(tunnel.config.remote_host.as_deref().unwrap_or("0.0.0.0")),
                        None,
                    )?;
                    ForwardListener::Remote(listener)
                }
            };

            if !tunnel.running() {
                return Err(AppError::Custom("Tunnel cancelled".into()));
            }
            session.set_blocking(false);
            Ok((session, listener))
        })();

        let (session, listener) = match setup {
            Ok(ready) => ready,
            Err(error) => {
                self.remove_current(&tunnel);
                return Err(error);
            }
        };
        let service = self.clone();
        thread::spawn(move || {
            match listener {
                ForwardListener::Local(listener) => listen_local(listener, session, &tunnel),
                ForwardListener::Remote(listener) => listen_remote(listener, &tunnel),
            }
            service.remove_current(&tunnel);
        });
        Ok(())
    }

    fn remove_current(&self, tunnel: &ActiveTunnel) {
        let mut tunnels = self.active_tunnels.lock().unwrap();
        let id = &tunnel.config.id;
        if tunnels
            .get(id)
            .is_some_and(|active| Arc::ptr_eq(&active.stop, &tunnel.stop))
        {
            tunnels.remove(id);
        }
        tunnel.cancel();
    }

    pub fn stop_tunnel(&self, tunnel_id: &str) -> Result<()> {
        if let Some(tunnel) = self.active_tunnels.lock().unwrap().remove(tunnel_id) {
            tunnel.cancel();
        }
        Ok(())
    }

    pub fn stop_session(&self, session_id: &str) {
        self.active_tunnels.lock().unwrap().retain(|_, tunnel| {
            if tunnel.session_id != session_id {
                return true;
            }
            tunnel.cancel();
            false
        });
    }

    pub fn get_active_tunnels(&self, session_id: &str) -> Vec<TunnelConfig> {
        self.active_tunnels
            .lock()
            .unwrap()
            .values()
            .filter(|tunnel| tunnel.session_id == session_id && tunnel.running())
            .map(|tunnel| tunnel.config.clone())
            .collect()
    }

    pub fn get_tunnel_stats(&self, session_id: &str) -> Vec<TunnelStats> {
        self.active_tunnels
            .lock()
            .unwrap()
            .values()
            .filter(|tunnel| tunnel.session_id == session_id)
            .map(|tunnel| TunnelStats {
                tunnel_id: tunnel.config.id.clone(),
                bytes_sent: tunnel.bytes_sent.load(Ordering::Relaxed),
                bytes_received: tunnel.bytes_received.load(Ordering::Relaxed),
                is_active: tunnel.running(),
            })
            .collect()
    }

    pub fn get_all_tunnel_ids(&self) -> Vec<String> {
        self.active_tunnels
            .lock()
            .unwrap()
            .keys()
            .cloned()
            .collect()
    }

    pub fn is_tunnel_active(&self, tunnel_id: &str) -> bool {
        self.active_tunnels.lock().unwrap().contains_key(tunnel_id)
    }
}

fn ssh_would_block(error: &ssh2::Error) -> bool {
    error.code() == ssh2::ErrorCode::Session(-37)
}

fn listen_local(listener: TcpListener, session: Session, tunnel: &ActiveTunnel) {
    let open_lock = Arc::new(Mutex::new(()));
    while tunnel.running() {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let tunnel = tunnel.clone();
                let session = session.clone();
                let open_lock = open_lock.clone();
                thread::spawn(move || {
                    if stream.set_nonblocking(true).is_err() {
                        return;
                    }
                    let dynamic = tunnel.config.tunnel_type == TunnelType::Dynamic;
                    let target = if dynamic {
                        read_socks_target(&mut stream, &tunnel)
                    } else {
                        Ok((
                            tunnel
                                .config
                                .remote_host
                                .clone()
                                .unwrap_or_else(|| "127.0.0.1".into()),
                            tunnel.config.remote_port.unwrap_or(80),
                        ))
                    };
                    let Ok((host, port)) = target else { return };
                    let channel = {
                        let _guard = open_lock.lock().unwrap();
                        open_forward_channel(&session, &host, port, &tunnel)
                    };

                    if dynamic {
                        let status = if channel.is_ok() { 0 } else { 1 };
                        if socks_io(
                            &tunnel,
                            |offset| stream.write(&[5, status, 0, 1, 0, 0, 0, 0, 0, 0][offset..]),
                            10,
                        )
                        .is_err()
                        {
                            return;
                        }
                    }
                    if let Ok(channel) = channel {
                        let _ = relay(stream, channel, &tunnel);
                    }
                });
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => thread::sleep(POLL_INTERVAL),
            Err(_) => break,
        }
    }
}

fn listen_remote(mut listener: Listener, tunnel: &ActiveTunnel) {
    while tunnel.running() {
        match listener.accept() {
            Ok(channel) => {
                let tunnel = tunnel.clone();
                thread::spawn(move || {
                    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, tunnel.config.local_port));
                    if let Ok(stream) = TcpStream::connect_timeout(&address, FORWARD_TIMEOUT) {
                        let _ = relay(stream, channel, &tunnel);
                    }
                });
            }
            Err(error) if ssh_would_block(&error) => thread::sleep(POLL_INTERVAL),
            Err(_) => break,
        }
    }
}

fn open_forward_channel(
    session: &Session,
    host: &str,
    port: u16,
    tunnel: &ActiveTunnel,
) -> Result<Channel> {
    let deadline = Instant::now() + FORWARD_TIMEOUT;
    while tunnel.running() && Instant::now() < deadline {
        match session.channel_direct_tcpip(host, port, None) {
            Ok(channel) => return Ok(channel),
            Err(error) if ssh_would_block(&error) => thread::sleep(POLL_INTERVAL),
            Err(error) => return Err(error.into()),
        }
    }
    Err(AppError::Custom(
        "Could not open SSH forwarding channel".into(),
    ))
}

fn socks_io(
    tunnel: &ActiveTunnel,
    mut operation: impl FnMut(usize) -> io::Result<usize>,
    size: usize,
) -> io::Result<()> {
    let deadline = Instant::now() + FORWARD_TIMEOUT;
    let mut offset = 0;
    while offset < size && tunnel.running() && Instant::now() < deadline {
        match operation(offset) {
            Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
            Ok(count) => offset += count,
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => thread::sleep(POLL_INTERVAL),
            Err(error) => return Err(error),
        }
    }
    if offset == size {
        Ok(())
    } else {
        Err(io::ErrorKind::TimedOut.into())
    }
}

fn read_socks_target(stream: &mut TcpStream, tunnel: &ActiveTunnel) -> io::Result<(String, u16)> {
    let mut greeting = [0; 2];
    socks_io(tunnel, |offset| stream.read(&mut greeting[offset..]), 2)?;
    if greeting[0] != 5 {
        return Err(io::ErrorKind::InvalidData.into());
    }
    let mut methods = vec![0; usize::from(greeting[1])];
    let method_count = methods.len();
    socks_io(
        tunnel,
        |offset| stream.read(&mut methods[offset..]),
        method_count,
    )?;
    let method = if methods.contains(&0) { 0 } else { 255 };
    socks_io(tunnel, |offset| stream.write(&[5, method][offset..]), 2)?;
    if method != 0 {
        return Err(io::ErrorKind::InvalidData.into());
    }
    let mut request = [0; 4];
    socks_io(tunnel, |offset| stream.read(&mut request[offset..]), 4)?;
    if request[..3] != [5, 1, 0] {
        return Err(io::ErrorKind::InvalidData.into());
    }
    let host = match request[3] {
        1 => {
            let mut address = [0; 4];
            socks_io(tunnel, |offset| stream.read(&mut address[offset..]), 4)?;
            Ipv4Addr::from(address).to_string()
        }
        4 => {
            let mut address = [0; 16];
            socks_io(tunnel, |offset| stream.read(&mut address[offset..]), 16)?;
            Ipv6Addr::from(address).to_string()
        }
        3 => {
            let mut length = [0];
            socks_io(tunnel, |offset| stream.read(&mut length[offset..]), 1)?;
            let address_len = usize::from(length[0]);
            let mut address = vec![0; address_len];
            socks_io(
                tunnel,
                |offset| stream.read(&mut address[offset..]),
                address_len,
            )?;
            String::from_utf8(address)
                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?
        }
        _ => return Err(io::ErrorKind::Unsupported.into()),
    };
    let mut port = [0; 2];
    socks_io(tunnel, |offset| stream.read(&mut port[offset..]), 2)?;
    Ok((host, u16::from_be_bytes(port)))
}

struct Transfer {
    bytes: [u8; 8192],
    length: usize,
    sent: usize,
    eof: bool,
}

impl Transfer {
    fn new() -> Self {
        Self {
            bytes: [0; 8192],
            length: 0,
            sent: 0,
            eof: false,
        }
    }

    fn relay(
        &mut self,
        source: &mut impl Read,
        target: &mut impl Write,
        total: &AtomicU64,
    ) -> io::Result<bool> {
        if self.eof {
            return Ok(false);
        }
        if self.sent == self.length {
            match source.read(&mut self.bytes) {
                Ok(0) => {
                    self.eof = true;
                    return Ok(true);
                }
                Ok(count) => {
                    self.length = count;
                    self.sent = 0;
                }
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => return Ok(false),
                Err(error) => return Err(error),
            }
        }
        match target.write(&self.bytes[self.sent..self.length]) {
            Ok(0) => Err(io::ErrorKind::WriteZero.into()),
            Ok(count) => {
                self.sent += count;
                total.fetch_add(count as u64, Ordering::Relaxed);
                Ok(true)
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => Ok(false),
            Err(error) => Err(error),
        }
    }
}

fn relay(mut stream: TcpStream, mut channel: Channel, tunnel: &ActiveTunnel) -> Result<()> {
    stream.set_nonblocking(true)?;
    let mut from_tcp = Transfer::new();
    let mut from_ssh = Transfer::new();
    let mut sent_eof = false;

    while tunnel.running() {
        let sent = from_tcp.relay(&mut stream, &mut channel, &tunnel.bytes_sent)?;
        let received = from_ssh.relay(&mut channel, &mut stream, &tunnel.bytes_received)?;
        if from_ssh.eof && received {
            let _ = stream.shutdown(Shutdown::Write);
        }
        if from_tcp.eof && !sent_eof {
            match channel.send_eof() {
                Ok(()) => sent_eof = true,
                Err(error) if ssh_would_block(&error) => {}
                Err(error) => return Err(error.into()),
            }
        }
        if from_ssh.eof && sent_eof {
            break;
        }
        if !sent && !received {
            thread::sleep(POLL_INTERVAL);
        }
    }
    let _ = channel.close();
    Ok(())
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
    fn stopping_a_session_cancels_only_its_tunnels() {
        let service = TunnelService::new();
        let create_tunnel = |id: &str| ActiveTunnel {
            config: TunnelConfig {
                id: id.into(),
                name: id.into(),
                tunnel_type: TunnelType::Local,
                local_port: 8080,
                remote_host: None,
                remote_port: None,
            },
            session_id: id.into(),
            is_running: Arc::new(AtomicBool::new(true)),
            bytes_sent: Arc::new(AtomicU64::new(0)),
            bytes_received: Arc::new(AtomicU64::new(0)),
            stop: Arc::new(ConnectionStop::default()),
        };
        let closing = create_tunnel("closing");
        let remaining = create_tunnel("remaining");
        {
            let mut active = service.active_tunnels.lock().unwrap();
            active.insert("closing".into(), closing.clone());
            active.insert("remaining".into(), remaining.clone());
        }

        service.stop_session("closing");

        assert!(closing.stop.is_cancelled());
        assert!(!service.is_tunnel_active("closing"));
        assert!(!remaining.stop.is_cancelled());
        assert!(service.is_tunnel_active("remaining"));
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
            stop: Arc::new(ConnectionStop::default()),
            bytes_sent: Arc::new(AtomicU64::new(0)),
            bytes_received: Arc::new(AtomicU64::new(0)),
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
            stop: Arc::new(ConnectionStop::default()),
            bytes_sent: Arc::new(AtomicU64::new(0)),
            bytes_received: Arc::new(AtomicU64::new(0)),
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
    fn test_tunnel_config_with_remote_host() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 8080,
            remote_host: Some("192.168.1.1".to_string()),
            remote_port: Some(443),
        };

        assert_eq!(
            config
                .remote_host
                .clone()
                .unwrap_or_else(|| "127.0.0.1".to_string()),
            "192.168.1.1"
        );
        assert_eq!(config.remote_port.unwrap_or(80), 443);
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
    fn test_tunnel_config_defaults() {
        let config = TunnelConfig {
            id: "t1".to_string(),
            name: "Test".to_string(),
            tunnel_type: TunnelType::Local,
            local_port: 0,
            remote_host: None,
            remote_port: None,
        };

        assert_eq!(config.local_port, 0);
        assert_eq!(
            config
                .remote_host
                .unwrap_or_else(|| "127.0.0.1".to_string()),
            "127.0.0.1"
        );
        assert_eq!(config.remote_port.unwrap_or(80), 80);
    }

    #[test]
    fn test_tunnel_stats_struct_combination() {
        let stats = TunnelStats {
            tunnel_id: "tunnel-1".to_string(),
            bytes_sent: 100,
            bytes_received: 200,
            is_active: true,
        };

        assert_eq!(stats.tunnel_id, "tunnel-1");
        assert_eq!(stats.bytes_sent, 100);
        assert_eq!(stats.bytes_received, 200);
        assert!(stats.is_active);
    }
}
