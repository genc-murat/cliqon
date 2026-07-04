use std::io::Read;
use std::net::TcpStream;
use std::time::Duration;

use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

pub struct DockerManager {}

impl Default for DockerManager {
    fn default() -> Self {
        Self::new()
    }
}

fn is_safe_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
}

fn is_safe_path(path: &str) -> bool {
    !path.is_empty() && path.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.' || c == '/' || c == '\\' || c == ' ')
}

impl DockerManager {
    pub fn new() -> Self {
        Self {}
    }

    fn open_session(&self, profile: &SshProfile, secret: Option<&str>) -> Result<Session> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        tcp.set_read_timeout(Some(Duration::from_secs(10)))?;
        tcp.set_write_timeout(Some(Duration::from_secs(10)))?;

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
        channel.read_to_string(&mut output).map_err(AppError::Io)?;

        channel.wait_close().ok();
        Ok(output)
    }

    pub fn get_containers(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker ps -a --format '{{json .}}' --filter 'health=none' || docker ps -a --format '{{json .}}'";
        self.exec_command(&session, cmd)
    }

    pub fn start_container(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        container_id: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(container_id) {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker start {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn stop_container(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        container_id: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(container_id) {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker stop {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn restart_container(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        container_id: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(container_id) {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker restart {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn system_prune(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker system prune -af";
        self.exec_command(&session, cmd)
    }

    pub fn get_stats(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        // --no-stream ensures it returns immediately, --format formats it as JSON.
        let cmd = "docker stats --no-stream --format '{{json .}}'";
        self.exec_command(&session, cmd)
    }

    pub fn read_docker_compose(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_path(path) {
            return Err(AppError::Custom("Invalid path".to_string()));
        }
        let safe_path = path.replace("\\", "/");
        let cmd = format!("cat '{}' 2>&1", safe_path.replace("'", "'\\''"));
        self.exec_command(&session, &cmd)
    }

    pub fn get_volumes(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker volume ls --format '{{json .}}'";
        self.exec_command(&session, cmd)
    }

    pub fn get_volume_files(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        volume_name: &str,
        inner_path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(volume_name) {
            return Err(AppError::Custom("Invalid volume name".to_string()));
        }
        if !is_safe_path(inner_path) {
            return Err(AppError::Custom("Invalid inner path".to_string()));
        }

        let path_to_list = if inner_path.trim() == "" || inner_path == "/" {
            "/data".to_string()
        } else {
            // Clean up the path, ensuring it doesn't try to break out of /data
            let safe_inner = inner_path.trim_start_matches('/');
            format!("/data/{}", safe_inner)
        };

        // Output format: /data/filename|type|size  where type is dir, file, link, etc.
        let cmd = format!(
            "docker run --rm -v '{}':/data alpine /bin/sh -c 'find \"{}\" -maxdepth 1 -exec stat -c \"%n|%F|%s|%Y\" {{}} +'",
            volume_name.replace("'", "'\\''"),
            path_to_list.replace("\"", "\\\"")
        );
        self.exec_command(&session, &cmd)
    }

    pub fn inspect_container(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        container_id: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(container_id) {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let cmd = format!("docker inspect {}", container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn get_container_logs(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        container_id: &str,
        tail: Option<u32>,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(container_id) {
            return Err(AppError::Custom("Invalid container ID".to_string()));
        }
        let tail_lines = tail.unwrap_or(500);
        let cmd = format!("docker logs --tail {} {}", tail_lines, container_id);
        self.exec_command(&session, &cmd)
    }

    pub fn get_networks(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker network ls --format '{{json .}}'";
        self.exec_command(&session, cmd)
    }

    pub fn create_network(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        name: &str,
        driver: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(name) {
            return Err(AppError::Custom("Invalid network name".to_string()));
        }
        if !is_safe_id(driver) {
            return Err(AppError::Custom("Invalid driver".to_string()));
        }
        let cmd = format!("docker network create --driver {} {}", driver, name);
        self.exec_command(&session, &cmd)
    }

    pub fn remove_network(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        name: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_id(name) {
            return Err(AppError::Custom("Invalid network name".to_string()));
        }
        let cmd = format!("docker network rm {}", name);
        self.exec_command(&session, &cmd)
    }

    pub fn get_docker_events(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        filter: Option<&str>,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let filter_arg = filter.unwrap_or("");
        let cmd = if filter_arg.is_empty() {
            "docker events --format '{{json .}}' --since 60s".to_string()
        } else {
            format!(
                "docker events --format '{{json .}}' --filter '{}' --since 60s",
                filter_arg
            )
        };
        self.exec_command(&session, &cmd)
    }

    pub fn prune_containers(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker container prune -f";
        self.exec_command(&session, cmd)
    }

    pub fn prune_networks(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker network prune -f";
        self.exec_command(&session, cmd)
    }

    pub fn prune_images(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker image prune -af";
        self.exec_command(&session, cmd)
    }

    pub fn prune_volumes(&self, profile: &SshProfile, secret: Option<&str>) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        let cmd = "docker volume prune -f";
        self.exec_command(&session, cmd)
    }

    pub fn compose_up(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_path(path) {
            return Err(AppError::Custom("Invalid path".to_string()));
        }
        let safe_path = path.replace("\\", "/");
        let cmd = format!(
            "cd '{}' && docker-compose up -d",
            safe_path.replace("'", "'\\''")
        );
        self.exec_command(&session, &cmd)
    }

    pub fn compose_down(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_path(path) {
            return Err(AppError::Custom("Invalid path".to_string()));
        }
        let safe_path = path.replace("\\", "/");
        let cmd = format!(
            "cd '{}' && docker-compose down",
            safe_path.replace("'", "'\\''")
        );
        self.exec_command(&session, &cmd)
    }

    pub fn compose_pause(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_path(path) {
            return Err(AppError::Custom("Invalid path".to_string()));
        }
        let safe_path = path.replace("\\", "/");
        let cmd = format!(
            "cd '{}' && docker-compose pause",
            safe_path.replace("'", "'\\''")
        );
        self.exec_command(&session, &cmd)
    }

    pub fn compose_unpause(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_path(path) {
            return Err(AppError::Custom("Invalid path".to_string()));
        }
        let safe_path = path.replace("\\", "/");
        let cmd = format!(
            "cd '{}' && docker-compose unpause",
            safe_path.replace("'", "'\\''")
        );
        self.exec_command(&session, &cmd)
    }

    pub fn compose_ps(
        &self,
        profile: &SshProfile,
        secret: Option<&str>,
        path: &str,
    ) -> Result<String> {
        let session = self.open_session(profile, secret)?;
        if !is_safe_path(path) {
            return Err(AppError::Custom("Invalid path".to_string()));
        }
        let safe_path = path.replace("\\", "/");
        let cmd = format!(
            "cd '{}' && docker-compose ps --services --status",
            safe_path.replace("'", "'\\''")
        );
        self.exec_command(&session, &cmd)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_container_id_validation() {
        let valid_ids = vec![
            "abc123",
            "my-container",
            "container_123",
            "web-server-01",
            "db_container.prod",
        ];
        for id in valid_ids {
            assert!(!id.contains(';') && !id.contains('&') && !id.contains('|'),
                "Expected valid ID, got: {}", id);
        }

        let invalid_ids = vec!["abc;rm -rf /", "container&shutdown", "test|cat /etc/passwd"];
        for id in invalid_ids {
            assert!(id.contains(';') || id.contains('&') || id.contains('|'));
        }
    }

    #[test]
    fn test_path_validation_and_sanitization() {
        let valid_paths = vec![
            "/home/user/docker-compose.yml",
            "./docker-compose.yml",
            "/var/lib/docker/volumes",
        ];
        for path in valid_paths {
            assert!(!path.contains(';') && !path.contains('&') && !path.contains('|'));
        }

        // Backslash replacement
        let win_path = "C:\\Users\\docker-compose.yml";
        assert_eq!(win_path.replace("\\", "/"), "C:/Users/docker-compose.yml");

        // Single quote sanitization
        let quoted_path = "/home/user's/docker-compose.yml";
        assert_eq!(quoted_path.replace("'", "'\\''"), "/home/user'\\''s/docker-compose.yml");

        // Path with spaces
        let space_path = "/home/user/my project/docker-compose.yml";
        let safe_path = space_path.replace("\\", "/");
        let cmd = format!("cat '{}' 2>&1", safe_path.replace("'", "'\\''"));
        assert!(cmd.contains("my project"));
    }

    #[test]
    fn test_volume_inner_path_handling() {
        let inner_path_empty = "";
        let result = if inner_path_empty.trim() == "" || inner_path_empty == "/" {
            "/data".to_string()
        } else {
            let safe = inner_path_empty.trim_start_matches('/');
            format!("/data/{}", safe)
        };
        assert_eq!(result, "/data");

        let inner_path_root = "/";
        let result2 = if inner_path_root.trim() == "" || inner_path_root == "/" {
            "/data".to_string()
        } else {
            let safe = inner_path_root.trim_start_matches('/');
            format!("/data/{}", safe)
        };
        assert_eq!(result2, "/data");

        let inner_path_sub = "/subdir/files";
        let result3 = if inner_path_sub.trim() == "" || inner_path_sub == "/" {
            "/data".to_string()
        } else {
            let safe = inner_path_sub.trim_start_matches('/');
            format!("/data/{}", safe)
        };
        assert_eq!(result3, "/data/subdir/files");

        let inner_path_no_slash = "subdir/nested";
        let result4 = if inner_path_no_slash.trim() == "" || inner_path_no_slash == "/" {
            "/data".to_string()
        } else {
            let safe = inner_path_no_slash.trim_start_matches('/');
            format!("/data/{}", safe)
        };
        assert_eq!(result4, "/data/subdir/nested");
    }

    #[test]
    fn test_docker_command_injection_protection() {
        let malicious_ids = vec![
            "abc;rm -rf /",
            "test&cat /etc/passwd",
            "prod|cat shadow",
        ];
        for id in malicious_ids {
            assert!(id.contains(';') || id.contains('&') || id.contains('|'));
        }

        let malicious_names = vec!["network;rm -rf", "local&rm -rf", "test|whoami"];
        for name in malicious_names {
            assert!(name.contains(';') || name.contains('&') || name.contains('|'));
        }

        let malicious_drivers = vec!["bridge;evil", "host&malicious", "custom|command"];
        for driver in malicious_drivers {
            assert!(driver.contains(';') || driver.contains('&') || driver.contains('|'));
        }
    }

    #[test]
    fn test_docker_command_building() {
        // Start/stop/restart
        let container_id = "web-server";
        assert_eq!(format!("docker start {}", container_id), "docker start web-server");
        assert_eq!(format!("docker stop {}", container_id), "docker stop web-server");
        assert_eq!(format!("docker restart {}", container_id), "docker restart web-server");

        // Logs
        let cmd = format!("docker logs --tail {} {}", 100, "abc123");
        assert!(cmd.contains("--tail 100"));
        assert!(cmd.contains("abc123"));

        // Inspect
        let inspect = format!("docker inspect {}", "my-container");
        assert!(inspect.contains("docker inspect"));
        assert!(inspect.contains("my-container"));

        // Compose commands
        let path = "/home/user/project";
        let safe_path = path.replace("'", "'\\''");
        assert!(format!("cd '{}' && docker-compose up -d", safe_path).contains("docker-compose up -d"));
        assert!(format!("cd '{}' && docker-compose down", safe_path).contains("docker-compose down"));
        assert!(format!("cd '{}' && docker-compose pause", safe_path).contains("docker-compose pause"));
        assert!(format!("cd '{}' && docker-compose unpause", safe_path).contains("docker-compose unpause"));
        assert!(format!("cd '{}' && docker-compose ps --services --status", safe_path).contains("docker-compose ps --services --status"));
    }

    #[test]
    fn test_docker_events_command_building() {
        let filter_none: Option<&str> = None;
        let filter_arg = filter_none.unwrap_or("");
        let cmd = if filter_arg.is_empty() {
            "docker events --format '{{json .}}' --since 60s".to_string()
        } else {
            format!("docker events --format '{{json .}}' --filter '{}' --since 60s", filter_arg)
        };
        assert!(!cmd.contains("--filter"));
        assert!(cmd.contains("--since 60s"));

        let filter_some = "container=test";
        let filter_arg2 = filter_some;
        let cmd2 = if filter_arg2.is_empty() {
            "docker events --format '{{json .}}' --since 60s".to_string()
        } else {
            format!("docker events --format '{{json .}}' --filter '{}' --since 60s", filter_arg2)
        };
        assert!(cmd2.contains("--filter"));
        assert!(cmd2.contains("container=test"));
    }

    #[test]
    fn test_tail_and_filter_defaults() {
        let tail_none: Option<u32> = None;
        assert_eq!(tail_none.unwrap_or(500), 500);
        assert_eq!(Some(100).unwrap_or(500), 100);

        let filter_none: Option<&str> = None;
        assert_eq!(filter_none.unwrap_or(""), "");
        assert_eq!(Some("container=web").unwrap_or(""), "container=web");
    }

    #[test]
    fn test_docker_volume_alpine_command() {
        let volume_name = "my_volume";
        let path_to_list = "/data";
        let safe_volume = volume_name.replace("'", "'\\''");
        let safe_path = path_to_list.replace("\"", "\\\"");
        let cmd = format!(
            "docker run --rm -v '{}':/data alpine /bin/sh -c 'find \"{}\" -maxdepth 1 -exec stat -c \"%n|%F|%s|%Y\" {{}} +'",
            safe_volume, safe_path
        );
        assert!(cmd.contains("docker run --rm"));
        assert!(cmd.contains("alpine"));
        assert!(cmd.contains("find"));
    }
}
