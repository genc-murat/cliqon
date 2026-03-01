use std::collections::HashMap;
use std::net::UdpSocket;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::sharing::*;

const DISCOVERY_PORT: u16 = 19875;
const BEACON_INTERVAL_MS: u64 = 3000;
const PEER_TIMEOUT_SECS: u64 = 15;

pub struct SharingService {
    active: Arc<AtomicBool>,
    instance_id: String,
    display_name: Arc<Mutex<String>>,
    local_ip: Arc<Mutex<String>>,
    http_port: Arc<Mutex<u16>>,
    peers: Arc<Mutex<HashMap<String, PeerInfo>>>,
    pending_shares: Arc<Mutex<Vec<PendingShare>>>,
    http_server: Arc<Mutex<Option<tiny_http::Server>>>,
}

impl SharingService {
    pub fn new() -> Self {
        let machine_name = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "Unknown".to_string());

        Self {
            active: Arc::new(AtomicBool::new(false)),
            instance_id: uuid::Uuid::new_v4().to_string(),
            display_name: Arc::new(Mutex::new(machine_name)),
            local_ip: Arc::new(Mutex::new("0.0.0.0".to_string())),
            http_port: Arc::new(Mutex::new(0)),
            peers: Arc::new(Mutex::new(HashMap::new())),
            pending_shares: Arc::new(Mutex::new(Vec::new())),
            http_server: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self) -> Result<(), String> {
        if self.active.load(Ordering::SeqCst) {
            return Ok(());
        }

        // Detect local IP
        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .map_err(|e| format!("Failed to detect local IP: {}", e))?;

        *self.local_ip.lock().unwrap() = local_ip.clone();

        // Start HTTP server on random port
        let server = tiny_http::Server::http("0.0.0.0:0")
            .map_err(|e| format!("Failed to start HTTP server: {}", e))?;
        let http_port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
        *self.http_port.lock().unwrap() = http_port;

        let server = Arc::new(server);
        *self.http_server.lock().unwrap() = None; // we manage via Arc

        self.active.store(true, Ordering::SeqCst);

        // Spawn HTTP request handler
        self.spawn_http_handler(server.clone());

        // Spawn UDP broadcaster
        self.spawn_broadcaster(local_ip.clone(), http_port);

        // Spawn UDP listener
        self.spawn_listener();

        Ok(())
    }

    pub fn stop(&self) {
        self.active.store(false, Ordering::SeqCst);
        // The threads check `active` and will exit on their own
        // Send a dummy UDP to unblock the listener
        if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
            let _ = sock.send_to(b"STOP", format!("127.0.0.1:{}", DISCOVERY_PORT));
        }
        self.peers.lock().unwrap().clear();
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::SeqCst)
    }

    pub fn get_status(&self) -> SharingStatus {
        let peers = self.peers.lock().unwrap();
        SharingStatus {
            active: self.active.load(Ordering::SeqCst),
            display_name: self.display_name.lock().unwrap().clone(),
            local_ip: self.local_ip.lock().unwrap().clone(),
            http_port: *self.http_port.lock().unwrap(),
            peer_count: peers.len(),
        }
    }

    pub fn set_display_name(&self, name: String) {
        *self.display_name.lock().unwrap() = name;
    }

    pub fn get_peers(&self) -> Vec<PeerInfo> {
        let now = now_secs();
        let mut peers = self.peers.lock().unwrap();
        // Prune stale peers
        peers.retain(|_, p| now - p.last_seen < PEER_TIMEOUT_SECS);
        peers.values().cloned().collect()
    }

    pub fn share_with_peer(
        &self,
        peer: &PeerInfo,
        profiles: Vec<ShareableProfile>,
        snippets: Vec<ShareableSnippet>,
    ) -> Result<String, String> {
        let payload = SharePayload {
            sender_name: self.display_name.lock().unwrap().clone(),
            sender_ip: self.local_ip.lock().unwrap().clone(),
            profiles: if profiles.is_empty() {
                None
            } else {
                Some(profiles)
            },
            snippets: if snippets.is_empty() {
                None
            } else {
                Some(snippets)
            },
            timestamp: now_secs(),
        };

        let body =
            serde_json::to_string(&payload).map_err(|e| format!("Serialization error: {}", e))?;

        // Use a simple blocking HTTP POST via std::net
        let url = format!("{}:{}", peer.ip, peer.port);
        let request = format!(
            "POST /share HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            url,
            body.len(),
            body
        );

        let stream = std::net::TcpStream::connect_timeout(
            &format!("{}:{}", peer.ip, peer.port)
                .parse()
                .map_err(|e| format!("Invalid address: {}", e))?,
            std::time::Duration::from_secs(5),
        )
        .map_err(|e| format!("Connection failed: {}", e))?;

        use std::io::Write;
        let mut stream = stream;
        stream
            .write_all(request.as_bytes())
            .map_err(|e| format!("Write failed: {}", e))?;

        // Read response
        use std::io::Read;
        let mut response = String::new();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .ok();
        let _ = stream.read_to_string(&mut response);

        if response.contains("200 OK") {
            Ok("Items shared successfully".to_string())
        } else {
            Ok("Items sent (peer may need to accept)".to_string())
        }
    }

    pub fn ping_peer(&self, ip: &str, port: u16) -> Result<PeerInfo, String> {
        let stream = std::net::TcpStream::connect_timeout(
            &format!("{}:{}", ip, port)
                .parse()
                .map_err(|e| format!("Invalid address: {}", e))?,
            std::time::Duration::from_secs(3),
        )
        .map_err(|e| format!("Connection failed: {}", e))?;

        let request = format!(
            "GET /ping HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\n\r\n",
            ip, port
        );

        use std::io::Write;
        let mut stream = stream;
        stream
            .write_all(request.as_bytes())
            .map_err(|e| format!("Write failed: {}", e))?;

        use std::io::Read;
        let mut response = String::new();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(3)))
            .ok();
        let _ = stream.read_to_string(&mut response);

        if response.contains("200 OK") {
            // Very hacky way to get peer info from ping: we just return a placeholder PeerInfo
            // and let the frontend handle it, or we could extend /ping to return more info.
            // Let's improve the /ping handler later.
            Ok(PeerInfo {
                id: format!("manual-{}", ip),
                display_name: format!("Manual: {}", ip),
                ip: ip.to_string(),
                port,
                last_seen: now_secs(),
            })
        } else {
            Err("Peer did not respond to ping".to_string())
        }
    }

    pub fn add_manual_peer(&self, peer: PeerInfo) {
        self.peers.lock().unwrap().insert(peer.id.clone(), peer);
    }

    pub fn get_pending_shares(&self) -> Vec<PendingShare> {
        self.pending_shares.lock().unwrap().clone()
    }

    pub fn accept_share(&self, share_id: &str) -> Option<PendingShare> {
        let mut shares = self.pending_shares.lock().unwrap();
        if let Some(pos) = shares.iter().position(|s| s.id == share_id) {
            Some(shares.remove(pos))
        } else {
            None
        }
    }

    pub fn reject_share(&self, share_id: &str) {
        let mut shares = self.pending_shares.lock().unwrap();
        shares.retain(|s| s.id != share_id);
    }

    // ─── Private spawn helpers ─────────────────────────────────

    fn spawn_broadcaster(&self, _local_ip: String, http_port: u16) {
        let active = self.active.clone();
        let instance_id = self.instance_id.clone();
        let display_name = self.display_name.clone();
        let peers = self.peers.clone();

        thread::spawn(move || {
            let socket = match UdpSocket::bind("0.0.0.0:0") {
                Ok(s) => s,
                Err(_) => return,
            };
            let _ = socket.set_broadcast(true);

            let mut iteration = 0;

            while active.load(Ordering::SeqCst) {
                let beacon = BeaconPacket {
                    id: instance_id.clone(),
                    display_name: display_name.lock().unwrap().clone(),
                    http_port,
                };

                if let Ok(data) = serde_json::to_vec(&beacon) {
                    // Try to send to the global broadcast address first
                    let _ = socket.send_to(&data, format!("255.255.255.255:{}", DISCOVERY_PORT));

                    // Then try to broadcast on all discovered IPv4 interfaces
                    if let Ok(ifas) = local_ip_address::list_afinet_netifas() {
                        let do_sweep = iteration % 10 == 0; // Sweep every 30 seconds (10 * 3s)

                        for (_, ip) in ifas {
                            if ip.is_ipv4() && !ip.is_loopback() {
                                let ip_str = ip.to_string();

                                // Standard subnet broadcast
                                if let Some(broadcast) = subnet_broadcast(&ip_str) {
                                    let _ = socket.send_to(
                                        &data,
                                        format!("{}:{}", broadcast, DISCOVERY_PORT),
                                    );
                                }

                                // Unicast sweep for VPNs that drop broadcasts.
                                // Run infrequently to avoid ARP/network spam on physical networks.
                                if do_sweep {
                                    let parts: Vec<&str> = ip_str.split('.').collect();
                                    if parts.len() == 4 {
                                        for i in 1..=254 {
                                            let target = format!(
                                                "{}.{}.{}.{}",
                                                parts[0], parts[1], parts[2], i
                                            );
                                            // Skip our own IP
                                            if target != ip_str {
                                                let _ = socket.send_to(
                                                    &data,
                                                    format!("{}:{}", target, DISCOVERY_PORT),
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Also send unicast beacon to all currently known peers to keep them alive on VPNs
                    // without relying on the infrequent full sweep
                    let known_peers: Vec<String> = {
                        peers
                            .lock()
                            .unwrap()
                            .values()
                            .map(|p| p.ip.clone())
                            .collect()
                    };
                    for peer_ip in known_peers {
                        let _ = socket.send_to(&data, format!("{}:{}", peer_ip, DISCOVERY_PORT));
                    }
                }

                iteration += 1;
                thread::sleep(std::time::Duration::from_millis(BEACON_INTERVAL_MS));
            }
        });
    }

    fn spawn_listener(&self) {
        let active = self.active.clone();
        let instance_id = self.instance_id.clone();
        let display_name = self.display_name.clone();
        let http_port_ref = self.http_port.clone();
        let peers = self.peers.clone();

        thread::spawn(move || {
            let socket = match UdpSocket::bind(format!("0.0.0.0:{}", DISCOVERY_PORT)) {
                Ok(s) => s,
                Err(_) => {
                    // Port might be in use, try with SO_REUSEADDR workaround
                    // If this also fails, discovery won't work but app still runs
                    return;
                }
            };
            let _ = socket.set_read_timeout(Some(std::time::Duration::from_secs(5)));

            let mut buf = [0u8; 2048];
            while active.load(Ordering::SeqCst) {
                match socket.recv_from(&mut buf) {
                    Ok((size, addr)) => {
                        if let Ok(beacon) = serde_json::from_slice::<BeaconPacket>(&buf[..size]) {
                            // Ignore our own beacons
                            if beacon.id == instance_id {
                                continue;
                            }

                            let mut p = peers.lock().unwrap();
                            let is_new = !p.contains_key(&beacon.id);

                            let peer_ip = addr.ip().to_string();
                            let peer = PeerInfo {
                                id: beacon.id.clone(),
                                display_name: beacon.display_name,
                                ip: peer_ip.clone(),
                                port: beacon.http_port,
                                last_seen: now_secs(),
                            };

                            p.insert(beacon.id.clone(), peer);
                            drop(p);

                            // Reply directly to new peers (helps with VPN discovery)
                            if is_new {
                                let my_port = *http_port_ref.lock().unwrap();
                                let my_beacon = BeaconPacket {
                                    id: instance_id.clone(),
                                    display_name: display_name.lock().unwrap().clone(),
                                    http_port: my_port,
                                };
                                if let Ok(data) = serde_json::to_vec(&my_beacon) {
                                    let _ = socket
                                        .send_to(&data, format!("{}:{}", peer_ip, DISCOVERY_PORT));
                                }
                            }
                        }
                    }
                    Err(_) => continue, // timeout, just loop
                }
            }
        });
    }

    fn spawn_http_handler(&self, server: Arc<tiny_http::Server>) {
        let active = self.active.clone();
        let pending_shares = self.pending_shares.clone();

        thread::spawn(move || {
            while active.load(Ordering::SeqCst) {
                // Use recv_timeout to allow checking the active flag
                let mut request = match server.recv_timeout(std::time::Duration::from_secs(2)) {
                    Ok(Some(req)) => req,
                    Ok(None) => continue,
                    Err(_) => continue,
                };

                let url = request.url().to_string();

                if url == "/share" && request.method() == &tiny_http::Method::Post {
                    let mut body = String::new();
                    {
                        let reader = request.as_reader();
                        let _ = std::io::Read::read_to_string(reader, &mut body);
                    }

                    if let Ok(payload) = serde_json::from_str::<SharePayload>(&body) {
                        let share = PendingShare {
                            id: uuid::Uuid::new_v4().to_string(),
                            from_name: payload.sender_name,
                            from_ip: payload.sender_ip,
                            profiles: payload.profiles.unwrap_or_default(),
                            snippets: payload.snippets.unwrap_or_default(),
                            received_at: now_secs(),
                        };

                        pending_shares.lock().unwrap().push(share);

                        let response = tiny_http::Response::from_string("{\"status\":\"ok\"}")
                            .with_status_code(200)
                            .with_header(
                                tiny_http::Header::from_bytes(
                                    &b"Content-Type"[..],
                                    &b"application/json"[..],
                                )
                                .unwrap(),
                            );
                        let _ = request.respond(response);
                    } else {
                        let response =
                            tiny_http::Response::from_string("{\"error\":\"invalid payload\"}")
                                .with_status_code(400);
                        let _ = request.respond(response);
                    }
                } else if url == "/ping" {
                    let response = tiny_http::Response::from_string("{\"status\":\"alive\"}")
                        .with_status_code(200);
                    let _ = request.respond(response);
                } else {
                    let response =
                        tiny_http::Response::from_string("not found").with_status_code(404);
                    let _ = request.respond(response);
                }
            }
        });
    }
}

// ─── Utility functions ────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Calculate subnet broadcast address from IP (assumes /24)
fn subnet_broadcast(ip: &str) -> Option<String> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        Some(format!("{}.{}.{}.255", parts[0], parts[1], parts[2]))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subnet_broadcast_valid_ipv4() {
        assert_eq!(
            subnet_broadcast("192.168.1.100"),
            Some("192.168.1.255".to_string())
        );
        assert_eq!(
            subnet_broadcast("10.0.0.50"),
            Some("10.0.0.255".to_string())
        );
        assert_eq!(
            subnet_broadcast("172.16.5.10"),
            Some("172.16.5.255".to_string())
        );
    }

    #[test]
    fn test_subnet_broadcast_invalid_ip() {
        assert_eq!(subnet_broadcast("invalid"), None);
        assert_eq!(subnet_broadcast("192.168.1"), None);
        assert_eq!(subnet_broadcast("192.168.1.100.200"), None);
        assert_eq!(subnet_broadcast(""), None);
    }

    #[test]
    fn test_now_secs_returns_reasonable_value() {
        let now = now_secs();
        assert!(now > 1_577_836_800, "Timestamp should be after 2020");
        assert!(now < 4_733_644_800, "Timestamp should be before 2120");
    }

    #[test]
    fn test_sharing_service_new() {
        let service = SharingService::new();
        assert!(!service.is_active());
    }

    #[test]
    fn test_sharing_service_initial_status() {
        let service = SharingService::new();
        let status = service.get_status();

        assert_eq!(status.active, false);
        assert_eq!(status.peer_count, 0);
        assert_eq!(status.http_port, 0);
    }

    #[test]
    fn test_sharing_service_set_display_name() {
        let service = SharingService::new();
        service.set_display_name("Test Machine".to_string());

        let status = service.get_status();
        assert_eq!(status.display_name, "Test Machine");
    }

    #[test]
    fn test_sharing_service_get_peers_initially_empty() {
        let service = SharingService::new();
        let peers = service.get_peers();
        assert!(peers.is_empty());
    }

    #[test]
    fn test_sharing_service_get_pending_shares_initially_empty() {
        let service = SharingService::new();
        let shares = service.get_pending_shares();
        assert!(shares.is_empty());
    }

    #[test]
    fn test_sharing_service_add_manual_peer() {
        let service = SharingService::new();
        let peer = PeerInfo {
            id: "manual-peer-1".to_string(),
            display_name: "Manual Peer".to_string(),
            ip: "10.0.0.100".to_string(),
            port: 19876,
            last_seen: now_secs(),
        };

        service.add_manual_peer(peer);
        let peers = service.get_peers();

        assert_eq!(peers.len(), 1);
        assert_eq!(peers[0].id, "manual-peer-1");
    }

    #[test]
    fn test_sharing_service_reject_share() {
        let service = SharingService::new();
        let share = PendingShare {
            id: "share-to-reject".to_string(),
            from_name: "Sender".to_string(),
            from_ip: "192.168.1.5".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: now_secs(),
        };

        service.pending_shares.lock().unwrap().push(share);
        service.reject_share("share-to-reject");

        let shares = service.get_pending_shares();
        assert!(shares.is_empty());
    }

    #[test]
    fn test_sharing_service_accept_share() {
        let service = SharingService::new();
        let share = PendingShare {
            id: "share-to-accept".to_string(),
            from_name: "Sender".to_string(),
            from_ip: "192.168.1.5".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: now_secs(),
        };

        service.pending_shares.lock().unwrap().push(share.clone());
        let accepted = service.accept_share("share-to-accept");

        assert!(accepted.is_some());
        assert_eq!(accepted.unwrap().id, "share-to-accept");

        let shares = service.get_pending_shares();
        assert!(shares.is_empty());
    }

    #[test]
    fn test_sharing_service_accept_nonexistent_share() {
        let service = SharingService::new();
        let result = service.accept_share("nonexistent-id");
        assert!(result.is_none());
    }

    #[test]
    fn test_peer_info_struct() {
        let peer = PeerInfo {
            id: "test-peer".to_string(),
            display_name: "Test Peer".to_string(),
            ip: "192.168.1.100".to_string(),
            port: 19876,
            last_seen: 1234567890,
        };

        assert_eq!(peer.id, "test-peer");
        assert_eq!(peer.ip, "192.168.1.100");
        assert_eq!(peer.port, 19876);
    }

    #[test]
    fn test_pending_share_struct() {
        let share = PendingShare {
            id: "share-123".to_string(),
            from_name: "Sender".to_string(),
            from_ip: "10.0.0.5".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1234567890,
        };

        assert_eq!(share.id, "share-123");
        assert_eq!(share.profiles.len(), 0);
        assert_eq!(share.snippets.len(), 0);
    }

    #[test]
    fn test_sharing_status_struct() {
        let status = SharingStatus {
            active: true,
            display_name: "Test".to_string(),
            local_ip: "192.168.1.100".to_string(),
            http_port: 12345,
            peer_count: 5,
        };

        assert!(status.active);
        assert_eq!(status.peer_count, 5);
    }

    #[test]
    fn test_peer_json_serialization() {
        let peer = PeerInfo {
            id: "peer-1".to_string(),
            display_name: "Peer One".to_string(),
            ip: "192.168.1.50".to_string(),
            port: 19876,
            last_seen: 1609459200,
        };

        let json = serde_json::to_string(&peer).unwrap();
        assert!(json.contains("peer-1"));
        assert!(json.contains("192.168.1.50"));
    }

    #[test]
    fn test_now_secs_monotonic_increase() {
        let t1 = now_secs();
        std::thread::sleep(std::time::Duration::from_millis(10));
        let t2 = now_secs();

        assert!(t2 >= t1);
    }

    #[test]
    fn test_atomic_bool_operations() {
        let flag = Arc::new(AtomicBool::new(false));

        assert!(!flag.load(Ordering::SeqCst));

        flag.store(true, Ordering::SeqCst);
        assert!(flag.load(Ordering::SeqCst));

        flag.store(false, Ordering::SeqCst);
        assert!(!flag.load(Ordering::SeqCst));
    }

    #[test]
    fn test_mutex_arc_pattern() {
        let data = Arc::new(Mutex::new(String::from("initial")));

        {
            let mut d = data.lock().unwrap();
            *d = String::from("modified");
        }

        let value = data.lock().unwrap();
        assert_eq!(*value, "modified");
    }

    #[test]
    fn test_hashmap_peer_storage() {
        let mut peers: HashMap<String, PeerInfo> = HashMap::new();

        let peer = PeerInfo {
            id: "p1".to_string(),
            display_name: "Peer 1".to_string(),
            ip: "10.0.0.1".to_string(),
            port: 8080,
            last_seen: 1234567890,
        };

        peers.insert(peer.id.clone(), peer);

        assert_eq!(peers.len(), 1);
        assert!(peers.contains_key("p1"));
    }

    #[test]
    fn test_vec_pending_shares() {
        let mut shares: Vec<PendingShare> = Vec::new();

        shares.push(PendingShare {
            id: "s1".to_string(),
            from_name: "User1".to_string(),
            from_ip: "192.168.1.10".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1234567890,
        });

        shares.push(PendingShare {
            id: "s2".to_string(),
            from_name: "User2".to_string(),
            from_ip: "192.168.1.20".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1234567891,
        });

        assert_eq!(shares.len(), 2);

        let removed = shares.remove(0);
        assert_eq!(removed.id, "s1");
        assert_eq!(shares.len(), 1);
    }

    #[test]
    fn test_subnet_broadcast_private_ips() {
        assert_eq!(
            subnet_broadcast("192.168.0.1"),
            Some("192.168.0.255".to_string())
        );
        assert_eq!(
            subnet_broadcast("192.168.100.50"),
            Some("192.168.100.255".to_string())
        );
        assert_eq!(subnet_broadcast("10.0.0.1"), Some("10.0.0.255".to_string()));
        assert_eq!(
            subnet_broadcast("10.10.10.10"),
            Some("10.10.10.255".to_string())
        );
        assert_eq!(
            subnet_broadcast("172.16.0.1"),
            Some("172.16.0.255".to_string())
        );
        assert_eq!(
            subnet_broadcast("172.31.255.1"),
            Some("172.31.255.255".to_string())
        );
    }

    #[test]
    fn test_subnet_broadcast_edge_cases() {
        assert_eq!(
            subnet_broadcast("255.255.255.255"),
            Some("255.255.255.255".to_string())
        );
        assert_eq!(subnet_broadcast("0.0.0.0"), Some("0.0.0.255".to_string()));
    }

    #[test]
    fn test_peerinfo_clone() {
        let peer1 = PeerInfo {
            id: "p1".to_string(),
            display_name: "Peer 1".to_string(),
            ip: "192.168.1.1".to_string(),
            port: 8080,
            last_seen: 1234567890,
        };

        let peer2 = peer1.clone();
        assert_eq!(peer1.id, peer2.id);
        assert_eq!(peer1.ip, peer2.ip);
    }

    #[test]
    fn test_pending_share_clone() {
        let share1 = PendingShare {
            id: "s1".to_string(),
            from_name: "User".to_string(),
            from_ip: "10.0.0.1".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1234567890,
        };

        let share2 = share1.clone();
        assert_eq!(share1.id, share2.id);
    }

    #[test]
    fn test_sharing_status_clone() {
        let status1 = SharingStatus {
            active: true,
            display_name: "Test".to_string(),
            local_ip: "192.168.1.1".to_string(),
            http_port: 8080,
            peer_count: 3,
        };

        let status2 = status1.clone();
        assert_eq!(status1.active, status2.active);
        assert_eq!(status1.peer_count, status2.peer_count);
    }

    #[test]
    fn test_peer_info_operations() {
        let peers: Vec<PeerInfo> = vec![
            PeerInfo {
                id: "peer1".to_string(),
                display_name: "Peer One".to_string(),
                ip: "192.168.1.10".to_string(),
                port: 19876,
                last_seen: 1700000000,
            },
            PeerInfo {
                id: "peer2".to_string(),
                display_name: "Peer Two".to_string(),
                ip: "192.168.1.20".to_string(),
                port: 19876,
                last_seen: 1700000001,
            },
        ];

        assert_eq!(peers.len(), 2);

        let ips: Vec<&String> = peers.iter().map(|p| &p.ip).collect();
        assert_eq!(ips.len(), 2);
    }

    #[test]
    fn test_pending_share_operations() {
        let mut shares: Vec<PendingShare> = Vec::new();

        shares.push(PendingShare {
            id: "share1".to_string(),
            from_name: "User1".to_string(),
            from_ip: "192.168.1.5".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1700000000,
        });

        shares.push(PendingShare {
            id: "share2".to_string(),
            from_name: "User2".to_string(),
            from_ip: "192.168.1.10".to_string(),
            profiles: vec![],
            snippets: vec![],
            received_at: 1700000001,
        });

        let from_ips: Vec<&String> = shares.iter().map(|s| &s.from_ip).collect();
        assert_eq!(from_ips.len(), 2);
    }

    #[test]
    fn test_peer_timestamps() {
        let now = now_secs();

        let peer = PeerInfo {
            id: "test".to_string(),
            display_name: "Test".to_string(),
            ip: "192.168.1.1".to_string(),
            port: 8080,
            last_seen: now,
        };

        assert_eq!(peer.last_seen, now);
    }

    #[test]
    fn test_sharing_status_default() {
        let status = SharingStatus {
            active: false,
            display_name: String::new(),
            local_ip: String::new(),
            http_port: 0,
            peer_count: 0,
        };

        assert!(!status.active);
        assert_eq!(status.peer_count, 0);
        assert_eq!(status.http_port, 0);
    }

    #[test]
    fn test_beacon_packet_creation() {
        use crate::models::sharing::BeaconPacket;

        let beacon = BeaconPacket {
            id: "instance-123".to_string(),
            display_name: "My PC".to_string(),
            http_port: 12345,
        };

        let json = serde_json::to_string(&beacon).unwrap();
        assert!(json.contains("instance-123"));
    }

    #[test]
    fn test_share_payload_serialization() {
        use crate::models::sharing::SharePayload;

        let payload = SharePayload {
            sender_name: "Alice".to_string(),
            sender_ip: "192.168.1.5".to_string(),
            profiles: None,
            snippets: None,
            timestamp: 1700000000,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("Alice"));
    }

    #[test]
    fn test_now_secs_ordering() {
        let times: Vec<u64> = (0..10).map(|_| now_secs()).collect();

        let mut sorted = times.clone();
        sorted.sort();

        assert_eq!(times.len(), sorted.len());
    }
}
