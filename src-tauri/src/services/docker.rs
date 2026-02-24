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
