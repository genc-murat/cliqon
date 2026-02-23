use std::collections::HashMap;
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

pub struct PoolConfig {
    pub max_idle_time_secs: u64,
    pub keepalive_interval_secs: u64,
    pub cleanup_interval_secs: u64,
    pub max_connections: usize,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_idle_time_secs: 300,
            keepalive_interval_secs: 30,
            cleanup_interval_secs: 60,
            max_connections: 50,
        }
    }
}

pub struct PooledConnection {
    pub profile_id: String,
    pub session: Arc<Mutex<Session>>,
    last_used: Arc<AtomicI64>,
    ref_count: Arc<AtomicU32>,
    #[allow(dead_code)]
    created_at: Instant,
    is_alive: Arc<AtomicBool>,
    last_keepalive: Arc<AtomicI64>,
}

impl PooledConnection {
    pub fn new(profile_id: String, session: Session) -> Self {
        let now = current_timestamp();
        Self {
            profile_id,
            session: Arc::new(Mutex::new(session)),
            last_used: Arc::new(AtomicI64::new(now)),
            ref_count: Arc::new(AtomicU32::new(0)),
            created_at: Instant::now(),
            is_alive: Arc::new(AtomicBool::new(true)),
            last_keepalive: Arc::new(AtomicI64::new(now)),
        }
    }

    pub fn touch(&self) {
        self.last_used.store(current_timestamp(), Ordering::SeqCst);
    }

    pub fn increment_ref(&self) -> u32 {
        self.ref_count.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn decrement_ref(&self) -> u32 {
        let prev = self.ref_count.fetch_sub(1, Ordering::SeqCst);
        prev.saturating_sub(1)
    }

    pub fn get_ref_count(&self) -> u32 {
        self.ref_count.load(Ordering::SeqCst)
    }

    pub fn get_idle_secs(&self) -> u64 {
        let last = self.last_used.load(Ordering::SeqCst);
        (current_timestamp() - last) as u64
    }

    pub fn is_idle_too_long(&self, max_idle_secs: u64) -> bool {
        self.get_ref_count() == 0 && self.get_idle_secs() > max_idle_secs
    }

    pub fn mark_dead(&self) {
        self.is_alive.store(false, Ordering::SeqCst);
    }

    pub fn is_alive(&self) -> bool {
        self.is_alive.load(Ordering::SeqCst)
    }

    pub fn needs_keepalive(&self, interval_secs: u64) -> bool {
        let last = self.last_keepalive.load(Ordering::SeqCst);
        (current_timestamp() - last) as u64 > interval_secs
    }

    pub fn touch_keepalive(&self) {
        self.last_keepalive
            .store(current_timestamp(), Ordering::SeqCst);
    }
}

fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

pub struct ConnectionPool {
    connections: Arc<Mutex<HashMap<String, Arc<PooledConnection>>>>,
    config: PoolConfig,
    active: Arc<AtomicBool>,
}

impl ConnectionPool {
    pub fn new(config: PoolConfig) -> Self {
        let connections = Arc::new(Mutex::new(HashMap::new()));
        let active = Arc::new(AtomicBool::new(true));

        let pool = Self {
            connections: connections.clone(),
            config,
            active: active.clone(),
        };

        pool.start_cleanup_thread();
        pool.start_keepalive_thread();

        pool
    }

    fn create_session(&self, profile: &SshProfile, secret: Option<&str>) -> Result<Session> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))
            .map_err(|e| AppError::Custom(format!("TCP connect failed: {}", e)))?;

        tcp.set_read_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| AppError::Custom(format!("Set read timeout failed: {}", e)))?;
        tcp.set_write_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| AppError::Custom(format!("Set write timeout failed: {}", e)))?;

        let mut session = Session::new()
            .map_err(|e| AppError::Custom(format!("Session creation failed: {}", e)))?;
        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|e| AppError::Custom(format!("SSH handshake failed: {}", e)))?;

        authenticate_session(&mut session, profile, secret)
            .map_err(|e| AppError::Custom(format!("Authentication failed: {}", e)))?;

        Ok(session)
    }

    pub fn get_or_create(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
    ) -> Result<Arc<PooledConnection>> {
        let mut connections = self.connections.lock().unwrap();

        if let Some(conn) = connections.get(&profile.id) {
            if conn.is_alive() && !conn.is_idle_too_long(self.config.max_idle_time_secs) {
                conn.touch();
                conn.increment_ref();
                return Ok(conn.clone());
            } else {
                connections.remove(&profile.id);
            }
        }

        if connections.len() >= self.config.max_connections {
            let oldest = connections
                .iter()
                .filter(|(_, c)| c.get_ref_count() == 0)
                .min_by_key(|(_, c)| c.last_used.load(Ordering::SeqCst))
                .map(|(k, _)| k.clone());

            if let Some(key) = oldest {
                connections.remove(&key);
            }
        }

        let session = self.create_session(profile, secret)?;
        let conn = Arc::new(PooledConnection::new(profile.id.clone(), session));
        conn.increment_ref();
        conn.touch();

        connections.insert(profile.id.clone(), conn.clone());

        Ok(conn)
    }

    pub fn get(&self, profile_id: &str) -> Option<Arc<PooledConnection>> {
        let connections = self.connections.lock().unwrap();
        connections.get(profile_id).map(|c| {
            c.touch();
            c.increment_ref();
            c.clone()
        })
    }

    pub fn release(&self, profile_id: &str) {
        let connections = self.connections.lock().unwrap();
        if let Some(conn) = connections.get(profile_id) {
            conn.decrement_ref();
        }
    }

    pub fn remove(&self, profile_id: &str) {
        let mut connections = self.connections.lock().unwrap();
        if let Some(conn) = connections.remove(profile_id) {
            conn.mark_dead();
        }
    }

    pub fn get_stats(&self) -> PoolStats {
        let connections = self.connections.lock().unwrap();
        let mut stats = PoolStats::default();

        for conn in connections.values() {
            stats.total_connections += 1;
            if conn.get_ref_count() > 0 {
                stats.active_connections += 1;
            } else {
                stats.idle_connections += 1;
            }
            stats.total_ref_count += conn.get_ref_count();
        }

        stats
    }

    pub fn get_connection_info(&self) -> Vec<ConnectionInfo> {
        let connections = self.connections.lock().unwrap();
        connections
            .values()
            .map(|c| ConnectionInfo {
                profile_id: c.profile_id.clone(),
                ref_count: c.get_ref_count(),
                idle_secs: c.get_idle_secs(),
                is_alive: c.is_alive(),
            })
            .collect()
    }

    fn start_cleanup_thread(&self) {
        let connections = self.connections.clone();
        let active = self.active.clone();
        let interval = self.config.cleanup_interval_secs;
        let max_idle = self.config.max_idle_time_secs;

        thread::spawn(move || {
            while active.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_secs(interval));

                let mut conns = connections.lock().unwrap();
                let to_remove: Vec<String> = conns
                    .iter()
                    .filter(|(_, c)| !c.is_alive() || c.is_idle_too_long(max_idle))
                    .map(|(k, _)| k.clone())
                    .collect();

                for key in to_remove {
                    if let Some(conn) = conns.remove(&key) {
                        conn.mark_dead();
                    }
                }
            }
        });
    }

    fn start_keepalive_thread(&self) {
        let connections = self.connections.clone();
        let active = self.active.clone();
        let interval = self.config.keepalive_interval_secs;

        thread::spawn(move || {
            while active.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_secs(5));

                let conns = connections.lock().unwrap();
                for conn in conns.values() {
                    if conn.is_alive() && conn.needs_keepalive(interval) {
                        if let Ok(session) = conn.session.lock() {
                            let _ = session.keepalive_send();
                        }
                        conn.touch_keepalive();
                    }
                }
            }
        });
    }

    pub fn shutdown(&self) {
        self.active.store(false, Ordering::SeqCst);
        let mut connections = self.connections.lock().unwrap();
        for conn in connections.values() {
            conn.mark_dead();
        }
        connections.clear();
    }
}

impl Drop for ConnectionPool {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[derive(Default, serde::Serialize)]
pub struct PoolStats {
    pub total_connections: usize,
    pub active_connections: usize,
    pub idle_connections: usize,
    pub total_ref_count: u32,
}

#[derive(serde::Serialize)]
pub struct ConnectionInfo {
    pub profile_id: String,
    pub ref_count: u32,
    pub idle_secs: u64,
    pub is_alive: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_config_default() {
        let config = PoolConfig::default();
        assert_eq!(config.max_idle_time_secs, 300);
        assert_eq!(config.keepalive_interval_secs, 30);
        assert_eq!(config.cleanup_interval_secs, 60);
        assert_eq!(config.max_connections, 50);
    }

    #[test]
    fn test_pooled_connection_ref_count() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("test".to_string(), session);

        assert_eq!(conn.get_ref_count(), 0);
        assert_eq!(conn.increment_ref(), 1);
        assert_eq!(conn.increment_ref(), 2);
        assert_eq!(conn.decrement_ref(), 1);
        assert_eq!(conn.decrement_ref(), 0);
    }

    #[test]
    fn test_pooled_connection_idle() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("test".to_string(), session);

        assert!(!conn.is_idle_too_long(0));
        assert!(!conn.is_idle_too_long(100));
    }

    #[test]
    fn test_pool_stats_default() {
        let stats = PoolStats::default();
        assert_eq!(stats.total_connections, 0);
        assert_eq!(stats.active_connections, 0);
        assert_eq!(stats.idle_connections, 0);
        assert_eq!(stats.total_ref_count, 0);
    }
}
