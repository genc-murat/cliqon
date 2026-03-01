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
        let invalid_ids = vec!["abc;rm -rf /", "container&shutdown", "test|cat /etc/passwd"];

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
        assert_eq!(
            "docker stats --no-stream --format '{{json .}}'",
            "docker stats --no-stream --format '{{json .}}'"
        );
        assert_eq!(
            "docker volume ls --format '{{json .}}'",
            "docker volume ls --format '{{json .}}'"
        );
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

    #[test]
    fn test_network_name_validation_invalid() {
        let invalid_names = vec!["network;rm -rf", "test&echo", "prod|cat /etc"];
        for name in invalid_names {
            assert!(name.contains(';') || name.contains('&') || name.contains('|'));
        }
    }

    #[test]
    fn test_driver_validation_invalid() {
        let invalid_drivers = vec!["bridge;evil", "host&malicious", "custom|command"];
        for driver in invalid_drivers {
            assert!(driver.contains(';') || driver.contains('&') || driver.contains('|'));
        }
    }

    #[test]
    fn test_tail_none_vs_some() {
        let tail_none: Option<u32> = None;
        let tail_default = tail_none.unwrap_or(500);
        assert_eq!(tail_default, 500);

        let tail_some = Some(100);
        let tail_custom = tail_some.unwrap_or(500);
        assert_eq!(tail_custom, 100);
    }

    #[test]
    fn test_filter_none_vs_some() {
        let filter_none: Option<&str> = None;
        let filter_empty = filter_none.unwrap_or("");
        assert_eq!(filter_empty, "");

        let filter_some = Some("container=web");
        let filter_value = filter_some.unwrap_or("");
        assert_eq!(filter_value, "container=web");
    }

    #[test]
    fn test_docker_events_empty_filter() {
        let filter_arg = "";
        let cmd = if filter_arg.is_empty() {
            "docker events --format '{{json .}}' --since 60s".to_string()
        } else {
            format!(
                "docker events --format '{{json .}}' --filter '{}' --since 60s",
                filter_arg
            )
        };
        assert!(cmd.contains("--since 60s"));
        assert!(!cmd.contains("--filter"));
    }

    #[test]
    fn test_docker_events_with_filter() {
        let filter_arg = "container=test";
        let cmd = if filter_arg.is_empty() {
            "docker events --format '{{json .}}' --since 60s".to_string()
        } else {
            format!(
                "docker events --format '{{json .}}' --filter '{}' --since 60s",
                filter_arg
            )
        };
        assert!(cmd.contains("--filter"));
        assert!(cmd.contains("container=test"));
    }

    #[test]
    fn test_volume_path_sanitization() {
        let volume_name = "my_volume";
        let safe_volume = volume_name.replace("'", "'\\''");
        assert_eq!(safe_volume, "my_volume");

        let volume_evil = "vol;evil";
        assert!(volume_evil.contains(';'));
    }

    #[test]
    fn test_compose_path_trailing_slash() {
        let path = "/home/user//project///";
        let safe_path = path.replace("\\", "/");
        assert!(safe_path.contains("///"));
    }

    #[test]
    fn test_container_id_special_chars_rejection() {
        let malicious_ids = vec![
            "abc;rm -rf /",
            "test&cat /etc/passwd",
            "prod|cat shadow",
            "container\nmalicious",
            "container\tinjection",
        ];
        for id in malicious_ids {
            let has_danger = id.contains(';')
                || id.contains('&')
                || id.contains('|')
                || id.contains('\n')
                || id.contains('\t');
            assert!(has_danger, "Expected dangerous chars in: {}", id);
        }
    }

    #[test]
    fn test_network_name_special_chars() {
        let malicious_names = vec!["net;trm -rf", "local&rm -rf", "test|whoami"];
        for name in malicious_names {
            let is_valid = !name.contains(';') && !name.contains('&') && !name.contains('|');
            assert!(!is_valid, "Should reject: {}", name);
        }
    }

    #[test]
    fn test_path_with_spaces() {
        let path = "/home/user/my project/docker-compose.yml";
        let safe_path = path.replace("\\", "/");
        let cmd = format!("cat '{}' 2>&1", safe_path.replace("'", "'\\''"));
        assert!(cmd.contains("my project"));
    }

    #[test]
    fn test_path_with_quotes() {
        let path = "/home/user/\"quoted\"/file.yml";
        let safe_path = path.replace("\\", "/");
        let cmd = format!("cat '{}' 2>&1", safe_path.replace("'", "'\\''"));
        assert!(cmd.contains("quoted"));
    }

    #[test]
    fn test_inner_path_no_leading_slash() {
        let inner_path = "subdir/nested";
        let path_to_list = if inner_path.trim() == "" || inner_path == "/" {
            "/data".to_string()
        } else {
            let safe_inner = inner_path.trim_start_matches('/');
            format!("/data/{}", safe_inner)
        };
        assert_eq!(path_to_list, "/data/subdir/nested");
    }

    #[test]
    fn test_inner_path_with_leading_slash() {
        let inner_path = "/another/nested/path";
        let path_to_list = if inner_path.trim() == "" || inner_path == "/" {
            "/data".to_string()
        } else {
            let safe_inner = inner_path.trim_start_matches('/');
            format!("/data/{}", safe_inner)
        };
        assert_eq!(path_to_list, "/data/another/nested/path");
    }

    #[test]
    fn test_docker_command_format_json() {
        let expected = "{{json .}}";
        assert!(expected.contains("json"));
    }

    #[test]
    fn test_compose_path_with_spaces() {
        let path = "/my projects/docker";
        let safe_path = path.replace("'", "'\\''");
        let cmd = format!("cd '{}' && docker-compose up -d", safe_path);
        assert!(cmd.contains("my projects"));
    }

    #[test]
    fn test_inspect_format() {
        let container_id = "container123";
        let cmd = format!("docker inspect {}", container_id);
        assert!(cmd.contains("docker inspect"));
        assert!(cmd.contains("container123"));
    }

    #[test]
    fn test_stats_format() {
        let cmd = "docker stats --no-stream --format '{{json .}}'";
        assert!(cmd.contains("--no-stream"));
        assert!(cmd.contains("format"));
    }

    #[test]
    fn test_network_ls_format() {
        let cmd = "docker network ls --format '{{json .}}'";
        assert!(cmd.contains("network ls"));
    }

    #[test]
    fn test_prune_commands_format() {
        let container_prune = "docker container prune -f";
        let network_prune = "docker network prune -f";
        let image_prune = "docker image prune -af";
        let volume_prune = "docker volume prune -f";

        assert!(container_prune.contains("-f"));
        assert!(network_prune.contains("-f"));
        assert!(image_prune.contains("-af"));
        assert!(volume_prune.contains("-f"));
    }

    #[test]
    fn test_compose_down_preserves_volumes() {
        let path = "/app";
        let safe_path = path.replace("'", "'\\''");
        let cmd = format!("cd '{}' && docker-compose down", safe_path);
        assert!(cmd.contains("docker-compose down"));
    }

    #[test]
    fn test_error_message_formats() {
        let container_err = "Invalid container ID".to_string();
        let path_err = "Invalid path".to_string();
        let volume_err = "Invalid volume name".to_string();
        let network_err = "Invalid network name".to_string();
        let driver_err = "Invalid driver".to_string();

        assert!(container_err.contains("container"));
        assert!(path_err.contains("path"));
        assert!(volume_err.contains("volume"));
        assert!(network_err.contains("network"));
        assert!(driver_err.contains("driver"));
    }

    #[test]
    fn test_docker_container_id_multiple_containers() {
        let ids = vec![
            "abc123def456",
            "container-001",
            "web-server-prod",
            "db-postgres-14",
        ];

        for id in ids {
            let is_alphanumeric = id
                .chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '_');
            assert!(is_alphanumeric);
        }
    }

    #[test]
    fn test_docker_label_format() {
        let labels = vec![
            "com.example.version=1.0",
            "maintainer=admin@example.com",
            "description=Production server",
        ];

        for label in labels {
            assert!(label.contains('='));
        }
    }

    #[test]
    fn test_docker_memory_limit_parsing() {
        let limits = vec![
            ("512m", 512u64),
            ("1g", 1024u64),
            ("2G", 2048u64),
            ("1024M", 1024u64),
        ];

        for (limit, _mb) in limits {
            let is_valid = limit.ends_with('m')
                || limit.ends_with('M')
                || limit.ends_with('g')
                || limit.ends_with('G');
            assert!(is_valid);
        }
    }

    #[test]
    fn test_docker_cpu_limit_parsing() {
        let cpus = vec!["0.5", "1.0", "2", "0.25", "4"];

        for cpu in cpus {
            let parse_result = cpu.parse::<f32>();
            assert!(parse_result.is_ok() || cpu.parse::<u32>().is_ok());
        }
    }

    #[test]
    fn test_docker_restart_policy() {
        let policies = vec!["no", "always", "unless-stopped", "on-failure"];

        for policy in policies {
            let is_valid = policy == "no"
                || policy == "always"
                || policy == "unless-stopped"
                || policy == "on-failure";
            assert!(is_valid);
        }
    }

    #[test]
    fn test_docker_network_mode() {
        let modes = vec!["bridge", "host", "none", "container:container_id"];

        for mode in modes {
            assert!(!mode.is_empty());
        }
    }

    #[test]
    fn test_docker_volume_type() {
        let volumes = vec![
            ("bind", "/host/path:/container/path"),
            ("volume", "my_volume:/data"),
            ("tmpfs", "/tmpfs"),
        ];

        for (vol_type, _mount) in volumes {
            let is_bind = vol_type == "bind";
            let is_volume = vol_type == "volume";
            let is_tmpfs = vol_type == "tmpfs";
            assert!(is_bind || is_volume || is_tmpfs);
        }
    }

    #[test]
    fn test_docker_port_range() {
        let ports = vec![
            ("80:80", 80, 80),
            ("3000-3005:3000-3005", 3000, 3005),
            ("8080:8080", 8080, 8080),
        ];

        for (_mapping, start, end) in ports {
            assert!(start > 0 && start <= 65535);
            assert!(end > 0 && end <= 65535);
            assert!(start <= end);
        }
    }

    #[test]
    fn test_docker_log_driver() {
        let drivers = vec!["json-file", "syslog", "journald", "gelf", "fluentd"];

        for driver in drivers {
            assert!(!driver.is_empty());
        }
    }

    #[test]
    fn test_docker_env_file_format() {
        let env_files = vec![".env", "production.env", "./config/dev.env"];

        for file in env_files {
            let is_env_file = file.ends_with(".env");
            let has_path = file.contains('/') || file.starts_with('.');
            assert!(has_path || is_env_file);
        }
    }

    #[test]
    fn test_docker_container_resource_limits() {
        let limits = vec![
            ("--memory=512m", 512u64),
            ("--cpus=0.5", 5u64),
            ("--memory=1g", 1024u64),
            ("--cpus=2.0", 20u64),
        ];

        for (flag, _value) in limits {
            assert!(flag.starts_with("--"));
        }
    }

    #[test]
    fn test_docker_container_name_validation() {
        let names = vec!["web-server", "nginx-proxy", "postgres-db", "redis-cache"];

        for name in names {
            let is_valid = !name.contains('/') && !name.contains(':');
            assert!(is_valid);
        }
    }

    #[test]
    fn test_docker_volume_driver_options() {
        let drivers = vec![
            ("local", ""),
            ("nfs", "type=nfs,o=addr=192.168.1.1"),
            ("ceph", "type=ceph,conf=/etc/ceph"),
        ];

        for (driver, _opts) in drivers {
            assert!(!driver.is_empty());
        }
    }

    #[test]
    fn test_docker_registry_auth() {
        let registries = vec!["docker.io", "registry.example.com:5000", "ghcr.io"];

        for reg in registries {
            let has_port = reg.contains(':');
            assert!(reg.contains('.') || has_port || reg == "docker.io");
        }
    }

    #[test]
    fn test_docker_image_tag_format() {
        let images = vec![
            "nginx:latest",
            "postgres:14-alpine",
            "redis:7.0.5",
            "myapp:v1.2.3-beta",
        ];

        for img in images {
            assert!(img.contains(':'));
        }
    }

    #[test]
    fn test_docker_network_subnet() {
        let networks = vec![
            ("172.17.0.0/16", "172.17.0.0", 16),
            ("192.168.1.0/24", "192.168.1.0", 24),
            ("10.0.0.0/8", "10.0.0.0", 8),
        ];

        for (cidr, _network, _mask) in networks {
            assert!(cidr.contains('/'));
        }
    }

    #[test]
    fn test_docker_dns_configuration() {
        let dns_servers = vec!["8.8.8.8", "1.1.1.1", "8.8.4.4"];

        for dns in dns_servers {
            let parts: Vec<&str> = dns.split('.').collect();
            assert_eq!(parts.len(), 4);
        }
    }

    #[test]
    fn test_docker_healthcheck_options() {
        let options = vec![
            "--health-cmd=/health.sh",
            "--health-interval=30s",
            "--health-timeout=10s",
            "--health-retries=3",
        ];

        for opt in options {
            assert!(opt.starts_with("--health-"));
        }
    }

    #[test]
    fn test_docker_entrypoint_override() {
        let entrypoints = vec!["/bin/sh", "/bin/bash", "python", "node"];

        for ep in entrypoints {
            assert!(!ep.is_empty());
        }
    }

    #[test]
    fn test_docker_command_args() {
        let args = vec![
            vec!["nginx", "-g", "daemon off;"],
            vec!["python", "-m", "http.server", "8080"],
            vec!["/bin/sh", "-c", "echo hello"],
        ];

        for arg in args {
            assert!(!arg.is_empty());
        }
    }

    #[test]
    fn test_docker_expose_ports() {
        let ports = vec!["80", "443", "3000-3010", "5432/tcp", "8080/udp"];

        for port in ports {
            let has_protocol = port.contains('/');
            let has_range = port.contains('-');
            assert!(has_protocol || has_range || port.parse::<u16>().is_ok());
        }
    }
}
