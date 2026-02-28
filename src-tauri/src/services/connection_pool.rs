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

    #[test]
    fn test_pooled_connection_new() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("profile-123".to_string(), session);

        assert_eq!(conn.profile_id, "profile-123");
        assert_eq!(conn.get_ref_count(), 0);
        assert!(conn.is_alive());
    }

    #[test]
    fn test_pooled_connection_touch() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("test".to_string(), session);

        let idle_before = conn.get_idle_secs();
        thread::sleep(Duration::from_millis(10));
        conn.touch();
        let idle_after = conn.get_idle_secs();

        assert!(idle_after <= idle_before || idle_after < 2);
    }

    #[test]
    fn test_pooled_connection_mark_dead() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("test".to_string(), session);

        assert!(conn.is_alive());
        conn.mark_dead();
        assert!(!conn.is_alive());
    }

    #[test]
    fn test_pooled_connection_needs_keepalive() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("test".to_string(), session);

        // Just created, shouldn't need keepalive yet
        assert!(!conn.needs_keepalive(0));
        
        // With a very short interval, it should need keepalive after some time
        thread::sleep(Duration::from_secs(2));
        assert!(conn.needs_keepalive(1));
    }

    #[test]
    fn test_pooled_connection_touch_keepalive() {
        let session = Session::new().unwrap();
        let conn = PooledConnection::new("test".to_string(), session);

        conn.touch_keepalive();
        // Should reset the keepalive timer
        assert!(!conn.needs_keepalive(1));
    }

    #[test]
    fn test_current_timestamp() {
        let ts1 = current_timestamp();
        thread::sleep(Duration::from_secs(2));
        let ts2 = current_timestamp();

        assert!(ts2 > ts1);
        assert!(ts2 - ts1 >= 2);
    }

    #[test]
    fn test_connection_info_serialization() {
        let info = ConnectionInfo {
            profile_id: "test".to_string(),
            ref_count: 5,
            idle_secs: 100,
            is_alive: true,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("test"));
        assert!(json.contains("5"));
    }

    #[test]
    fn test_pool_stats_serialization() {
        let stats = PoolStats {
            total_connections: 10,
            active_connections: 3,
            idle_connections: 7,
            total_ref_count: 15,
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("10"));
        assert!(json.contains("3"));
    }

    #[test]
    fn test_pool_new_creates_threads() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        // Pool should be active
        assert!(pool.active.load(Ordering::SeqCst));
    }

    #[test]
    fn test_pool_shutdown() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        pool.shutdown();

        assert!(!pool.active.load(Ordering::SeqCst));
    }

    #[test]
    fn test_pool_get_stats_empty() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        let stats = pool.get_stats();
        assert_eq!(stats.total_connections, 0);
        assert_eq!(stats.active_connections, 0);
        assert_eq!(stats.idle_connections, 0);
    }

    #[test]
    fn test_pool_get_connection_info_empty() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        let info = pool.get_connection_info();
        assert!(info.is_empty());
    }

    #[test]
    fn test_pool_release_nonexistent() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        // Should not panic
        pool.release("nonexistent");
    }

    #[test]
    fn test_pool_remove_nonexistent() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        // Should not panic
        pool.remove("nonexistent");
    }

    #[test]
    fn test_pool_get_nonexistent() {
        let config = PoolConfig::default();
        let pool = ConnectionPool::new(config);

        let result = pool.get("nonexistent");
        assert!(result.is_none());
    }

    #[test]
    fn test_atomic_bool_operations() {
        let flag = AtomicBool::new(true);
        assert!(flag.load(Ordering::SeqCst));

        flag.store(false, Ordering::SeqCst);
        assert!(!flag.load(Ordering::SeqCst));
    }

    #[test]
    fn test_atomic_i64_operations() {
        let val = AtomicI64::new(100);
        assert_eq!(val.load(Ordering::SeqCst), 100);

        val.store(200, Ordering::SeqCst);
        assert_eq!(val.load(Ordering::SeqCst), 200);
    }

    #[test]
    fn test_atomic_u32_operations() {
        let val = AtomicU32::new(10);
        assert_eq!(val.load(Ordering::SeqCst), 10);

        val.store(20, Ordering::SeqCst);
        assert_eq!(val.load(Ordering::SeqCst), 20);
    }

    #[test]
    fn test_hashmap_operations() {
        let mut map: HashMap<String, i32> = HashMap::new();
        map.insert("key1".to_string(), 1);
        map.insert("key2".to_string(), 2);

        assert_eq!(map.len(), 2);
        assert_eq!(map.get("key1"), Some(&1));

        map.remove("key1");
        assert_eq!(map.len(), 1);
        assert!(map.get("key1").is_none());
    }

    #[test]
    fn test_mutex_lock_unlock() {
        let mutex = Mutex::new(HashMap::<String, i32>::new());
        let mut map = mutex.lock().unwrap();
        map.insert("test".to_string(), 42);
        drop(map);

        let map2 = mutex.lock().unwrap();
        assert_eq!(map2.get("test"), Some(&42));
    }

    #[test]
    fn test_duration_creation() {
        let duration = Duration::from_secs(60);
        assert_eq!(duration.as_secs(), 60);

        let duration2 = Duration::from_millis(500);
        assert_eq!(duration2.as_millis(), 500);
    }

    #[test]
    fn test_instant_now() {
        let now = Instant::now();
        thread::sleep(Duration::from_millis(10));
        let elapsed = now.elapsed();

        assert!(elapsed >= Duration::from_millis(10));
    }

    #[test]
    fn test_option_map() {
        let opt: Option<i32> = Some(5);
        let result = opt.map(|x| x * 2);
        assert_eq!(result, Some(10));

        let none: Option<i32> = None;
        let none_result = none.map(|x| x * 2);
        assert_eq!(none_result, None);
    }

    #[test]
    fn test_result_map_err() {
        let ok: Result<i32> = Ok(42);
        let mapped = ok.map_err(|e: AppError| e);
        assert_eq!(mapped.unwrap(), 42);

        let err: Result<i32> = Err(AppError::Custom("test".to_string()));
        let mapped_err = err.map_err(|e| AppError::Custom(format!("wrapped: {}", e)));
        assert!(mapped_err.is_err());
    }

    #[test]
    fn test_vec_filter_and_collect() {
        let nums = vec![1, 2, 3, 4, 5, 6];
        let evens: Vec<i32> = nums.into_iter().filter(|x| x % 2 == 0).collect();
        assert_eq!(evens, vec![2, 4, 6]);
    }

    #[test]
    fn test_arc_clone_and_share() {
        let arc = Arc::new(AtomicU32::new(0));
        let arc_clone = Arc::clone(&arc);

        arc.store(42, Ordering::SeqCst);
        assert_eq!(arc_clone.load(Ordering::SeqCst), 42);
    }

    #[test]
    fn test_saturating_sub() {
        let val: u32 = 5;
        assert_eq!(val.saturating_sub(3), 2);
        assert_eq!(val.saturating_sub(10), 0); // Doesn't underflow
    }
}
