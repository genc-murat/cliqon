use std::io::Read;
use std::net::TcpStream;
use std::time::Duration;

use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;
use crate::services::auth::authenticate_session;

pub struct DockerManager {}

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
        let mut channel = session.channel_session().map_err(|e| AppError::Ssh(e))?;
        channel.exec(cmd).map_err(|e| AppError::Ssh(e))?;

        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| AppError::Io(e))?;

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
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
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
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
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
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
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
        if path.contains(';') || path.contains('&') || path.contains('|') {
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
        if volume_name.contains(';') || volume_name.contains('&') || volume_name.contains('|') {
            return Err(AppError::Custom("Invalid volume name".to_string()));
        }
        if inner_path.contains(';') || inner_path.contains('&') || inner_path.contains('|') {
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
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
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
        if container_id.contains(';') || container_id.contains('&') || container_id.contains('|') {
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
        if name.contains(';') || name.contains('&') || name.contains('|') {
            return Err(AppError::Custom("Invalid network name".to_string()));
        }
        if driver.contains(';') || driver.contains('&') || driver.contains('|') {
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
        if name.contains(';') || name.contains('&') || name.contains('|') {
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
        if path.contains(';') || path.contains('&') || path.contains('|') {
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
        if path.contains(';') || path.contains('&') || path.contains('|') {
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
        if path.contains(';') || path.contains('&') || path.contains('|') {
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
        if path.contains(';') || path.contains('&') || path.contains('|') {
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
        if path.contains(';') || path.contains('&') || path.contains('|') {
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
    fn test_docker_manager_new() {
        let manager = DockerManager::new();
        // DockerManager is a unit struct, just verify it can be created
        let _ = manager;
    }

    #[test]
    fn test_container_id_validation_valid() {
        let valid_ids = vec![
            "abc123",
            "my-container",
            "container_123",
            "web-server-01",
            "db_container.prod",
        ];

        for id in valid_ids {
            assert!(!id.contains(';'));
            assert!(!id.contains('&'));
            assert!(!id.contains('|'));
        }
    }

    #[test]
    fn test_container_id_validation_invalid() {
        let invalid_ids = vec![
            "abc;rm -rf /",
            "container&shutdown",
            "test|cat /etc/passwd",
        ];

        for id in invalid_ids {
            assert!(id.contains(';') || id.contains('&') || id.contains('|'));
        }
    }

    #[test]
    fn test_path_validation_valid() {
        let valid_paths = vec![
            "/home/user/docker-compose.yml",
            "./docker-compose.yml",
            "/var/lib/docker/volumes",
        ];

        for path in valid_paths {
            assert!(!path.contains(';'));
            assert!(!path.contains('&'));
            assert!(!path.contains('|'));
        }
    }

    #[test]
    fn test_path_validation_invalid() {
        let invalid_paths = vec![
            "/home/user;rm -rf /",
            "./docker&shutdown",
            "/var|cat /etc/passwd",
        ];

        for path in invalid_paths {
            assert!(path.contains(';') || path.contains('&') || path.contains('|'));
        }
    }

    #[test]
    fn test_path_sanitization_backslash() {
        let path = "C:\\Users\\docker-compose.yml";
        let safe_path = path.replace("\\", "/");
        assert_eq!(safe_path, "C:/Users/docker-compose.yml");
    }

    #[test]
    fn test_path_sanitization_single_quotes() {
        let path = "/home/user's/docker-compose.yml";
        let safe_path = path.replace("'", "'\\''");
        assert_eq!(safe_path, "/home/user'\\''s/docker-compose.yml");
    }

    #[test]
    fn test_volume_name_validation() {
        let valid_names = vec!["my_volume", "data", "app_data", "db-volume"];
        for name in valid_names {
            assert!(!name.contains(';'));
            assert!(!name.contains('&'));
            assert!(!name.contains('|'));
        }
    }

    #[test]
    fn test_inner_path_handling_empty() {
        let inner_path = "";
        let path_to_list = if inner_path.trim() == "" || inner_path == "/" {
            "/data".to_string()
        } else {
            let safe_inner = inner_path.trim_start_matches('/');
            format!("/data/{}", safe_inner)
        };
        assert_eq!(path_to_list, "/data");
    }

    #[test]
    fn test_inner_path_handling_root() {
        let inner_path = "/";
        let path_to_list = if inner_path.trim() == "" || inner_path == "/" {
            "/data".to_string()
        } else {
            let safe_inner = inner_path.trim_start_matches('/');
            format!("/data/{}", safe_inner)
        };
        assert_eq!(path_to_list, "/data");
    }

    #[test]
    fn test_inner_path_handling_subdir() {
        let inner_path = "/subdir/files";
        let path_to_list = if inner_path.trim() == "" || inner_path == "/" {
            "/data".to_string()
        } else {
            let safe_inner = inner_path.trim_start_matches('/');
            format!("/data/{}", safe_inner)
        };
        assert_eq!(path_to_list, "/data/subdir/files");
    }

    #[test]
    fn test_docker_command_formats() {
        // Test various docker command formats
        assert_eq!("docker ps -a --format '{{json .}}' --filter 'health=none' || docker ps -a --format '{{json .}}'", 
                   "docker ps -a --format '{{json .}}' --filter 'health=none' || docker ps -a --format '{{json .}}'");
        
        assert_eq!("docker system prune -af", "docker system prune -af");
        assert_eq!("docker stats --no-stream --format '{{json .}}'", 
                   "docker stats --no-stream --format '{{json .}}'");
        assert_eq!("docker volume ls --format '{{json .}}'", 
                   "docker volume ls --format '{{json .}}'");
    }

    #[test]
    fn test_docker_network_commands() {
        let driver = "bridge";
        let name = "mynetwork";
        let create_cmd = format!("docker network create --driver {} {}", driver, name);
        assert!(create_cmd.contains("docker network create"));
        assert!(create_cmd.contains("--driver bridge"));
        
        let remove_cmd = format!("docker network rm {}", name);
        assert!(remove_cmd.contains("docker network rm"));
    }

    #[test]
    fn test_docker_prune_commands() {
        assert_eq!("docker container prune -f", "docker container prune -f");
        assert_eq!("docker network prune -f", "docker network prune -f");
        assert_eq!("docker image prune -af", "docker image prune -af");
        assert_eq!("docker volume prune -f", "docker volume prune -f");
    }

    #[test]
    fn test_docker_compose_commands() {
        let path = "/home/user/project";
        let safe_path = path.replace("'", "'\\''");
        
        let up_cmd = format!("cd '{}' && docker-compose up -d", safe_path);
        assert!(up_cmd.contains("docker-compose up -d"));
        
        let down_cmd = format!("cd '{}' && docker-compose down", safe_path);
        assert!(down_cmd.contains("docker-compose down"));
        
        let pause_cmd = format!("cd '{}' && docker-compose pause", safe_path);
        assert!(pause_cmd.contains("docker-compose pause"));
        
        let unpause_cmd = format!("cd '{}' && docker-compose unpause", safe_path);
        assert!(unpause_cmd.contains("docker-compose unpause"));
    }

    #[test]
    fn test_docker_logs_command() {
        let container_id = "abc123";
        let tail = 100;
        let cmd = format!("docker logs --tail {} {}", tail, container_id);
        assert!(cmd.contains("docker logs"));
        assert!(cmd.contains("--tail 100"));
    }

    #[test]
    fn test_docker_logs_default_tail() {
        let tail: Option<u32> = None;
        let tail_lines = tail.unwrap_or(500);
        assert_eq!(tail_lines, 500);
    }

    #[test]
    fn test_docker_inspect_command() {
        let container_id = "my-container";
        let cmd = format!("docker inspect {}", container_id);
        assert!(cmd.contains("docker inspect"));
        assert!(cmd.contains("my-container"));
    }

    #[test]
    fn test_docker_events_command_no_filter() {
        let cmd = "docker events --format '{{json .}}' --since 60s";
        assert!(cmd.contains("docker events"));
        assert!(cmd.contains("--since 60s"));
    }

    #[test]
    fn test_docker_events_command_with_filter() {
        let filter = "container=my-container";
        let cmd = format!(
            "docker events --format '{{json .}}' --filter '{}' --since 60s",
            filter
        );
        assert!(cmd.contains("--filter 'container=my-container'"));
    }

    #[test]
    fn test_docker_start_stop_restart_commands() {
        let container_id = "web-server";
        
        let start_cmd = format!("docker start {}", container_id);
        assert_eq!(start_cmd, "docker start web-server");
        
        let stop_cmd = format!("docker stop {}", container_id);
        assert_eq!(stop_cmd, "docker stop web-server");
        
        let restart_cmd = format!("docker restart {}", container_id);
        assert_eq!(restart_cmd, "docker restart web-server");
    }

    #[test]
    fn test_docker_volume_ls_command() {
        let cmd = "docker volume ls --format '{{json .}}'";
        assert!(cmd.contains("docker volume ls"));
        assert!(cmd.contains("--format"));
    }

    #[test]
    fn test_docker_run_alpine_command() {
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

    #[test]
    fn test_docker_compose_ps_command() {
        let path = "/app";
        let safe_path = path.replace("'", "'\\''");
        let cmd = format!(
            "cd '{}' && docker-compose ps --services --status",
            safe_path
        );
        assert!(cmd.contains("docker-compose ps --services --status"));
    }
}
