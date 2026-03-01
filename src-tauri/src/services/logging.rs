use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;
use ssh2::Session;
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct LogManager {
    // Keeps track of active log tailing sessions
    // Using a simple flag to signal the thread to stop
    active_tails: Arc<Mutex<std::collections::HashMap<String, Arc<Mutex<bool>>>>>,
}

impl Default for LogManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LogManager {
    pub fn new() -> Self {
        Self {
            active_tails: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub fn start_tail(
        &self,
        app: AppHandle,
        profile: SshProfile,
        secret: Option<String>,
        path: String,
        session_id: String,
    ) -> Result<()> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        authenticate_session(&mut session, &profile, secret.as_deref())?;

        let mut channel = session.channel_session()?;

        let safe_path = path.replace("'", "'\\''");
        // Tail the last 200 lines and follow
        let cmd = format!("tail -n 200 -f '{}' 2>&1", safe_path);
        channel.exec(&cmd)?;

        // We set session to non-blocking so we can periodically check the stop flag
        session.set_blocking(false);

        let stop_flag = Arc::new(Mutex::new(false));
        self.active_tails
            .lock()
            .unwrap()
            .insert(session_id.clone(), stop_flag.clone());

        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            use std::io::Read;

            loop {
                // Check if we need to stop
                if *stop_flag.lock().unwrap() {
                    break;
                }

                match channel.read(&mut buf) {
                    Ok(0) => {
                        // EOF
                        let _ = app.emit(&format!("log_tail_close_{}", session_id), ());
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                        let _ = app.emit(&format!("log_tail_rx_{}", session_id), data);
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No data right now, sleep briefly
                        thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => {
                        // read error
                        let _ = app.emit(&format!("log_tail_error_{}", session_id), e.to_string());
                        break;
                    }
                }
            }

            // Cleanup
            let _ = channel.send_eof();
            let _ = channel.close();
            let _ = channel.wait_close();
        });

        Ok(())
    }

    pub fn stop_tail(&self, session_id: &str) {
        let mut map = self.active_tails.lock().unwrap();
        if let Some(flag) = map.remove(session_id) {
            *flag.lock().unwrap() = true;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_manager_new() {
        let manager = LogManager::new();
        let lock = manager.active_tails.lock().unwrap();
        assert!(lock.is_empty());
    }

    #[test]
    fn test_active_tails_initially_empty() {
        let manager = LogManager::new();
        let map = manager.active_tails.lock().unwrap();
        assert_eq!(map.len(), 0);
    }

    #[test]
    fn test_stop_tail_nonexistent() {
        let manager = LogManager::new();
        manager.stop_tail("nonexistent-session");
        // Should not panic
    }

    #[test]
    fn test_stop_tail_flag_set() {
        let manager = LogManager::new();

        // Manually insert a stop flag for testing
        let stop_flag = Arc::new(Mutex::new(false));
        manager
            .active_tails
            .lock()
            .unwrap()
            .insert("test-session".to_string(), stop_flag.clone());

        // Verify it's initially false
        assert!(!*stop_flag.lock().unwrap());

        // Stop the tail
        manager.stop_tail("test-session");

        // Verify flag is now true
        assert!(*stop_flag.lock().unwrap());
    }

    #[test]
    fn test_stop_tail_removes_from_map() {
        let manager = LogManager::new();

        let stop_flag = Arc::new(Mutex::new(false));
        manager
            .active_tails
            .lock()
            .unwrap()
            .insert("test-session".to_string(), stop_flag);

        // Verify it exists
        assert!(manager
            .active_tails
            .lock()
            .unwrap()
            .contains_key("test-session"));

        // Stop the tail
        manager.stop_tail("test-session");

        // Verify it's removed
        assert!(!manager
            .active_tails
            .lock()
            .unwrap()
            .contains_key("test-session"));
    }

    #[test]
    fn test_multiple_stop_tails() {
        let manager = LogManager::new();

        let flag1 = Arc::new(Mutex::new(false));
        let flag2 = Arc::new(Mutex::new(false));

        manager
            .active_tails
            .lock()
            .unwrap()
            .insert("session-1".to_string(), flag1);
        manager
            .active_tails
            .lock()
            .unwrap()
            .insert("session-2".to_string(), flag2);

        manager.stop_tail("session-1");
        manager.stop_tail("session-2");

        let map = manager.active_tails.lock().unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn test_log_manager_mutex_access() {
        let manager = LogManager::new();

        // Test that we can lock and unlock the mutex
        let lock = manager.active_tails.lock().unwrap();
        drop(lock);

        // Should be able to lock again
        let lock2 = manager.active_tails.lock().unwrap();
        assert!(lock2.is_empty());
    }

    #[test]
    fn test_stop_flag_default_value() {
        let flag = Arc::new(Mutex::new(false));
        assert!(!*flag.lock().unwrap());
    }

    #[test]
    fn test_stop_flag_can_be_set() {
        let flag = Arc::new(Mutex::new(false));
        *flag.lock().unwrap() = true;
        assert!(*flag.lock().unwrap());
    }

    #[test]
    fn test_hashmap_insert_and_contains() {
        let mut map: std::collections::HashMap<String, Arc<Mutex<bool>>> =
            std::collections::HashMap::new();
        let flag = Arc::new(Mutex::new(false));

        map.insert("test".to_string(), flag);
        assert!(map.contains_key("test"));
        assert_eq!(map.len(), 1);
    }

    #[test]
    fn test_hashmap_remove() {
        let mut map: std::collections::HashMap<String, Arc<Mutex<bool>>> =
            std::collections::HashMap::new();
        let flag = Arc::new(Mutex::new(false));

        map.insert("test".to_string(), flag);
        map.remove("test");

        assert!(!map.contains_key("test"));
        assert_eq!(map.len(), 0);
    }
}
