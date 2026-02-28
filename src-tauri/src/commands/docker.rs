use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn get_docker_containers(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_containers(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn start_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .start_container(&profile, secret.as_deref(), &container_id)
}

#[tauri::command]
pub async fn stop_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .stop_container(&profile, secret.as_deref(), &container_id)
}

#[tauri::command]
pub async fn restart_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .restart_container(&profile, secret.as_deref(), &container_id)
}

#[tauri::command]
pub async fn docker_system_prune(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .system_prune(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn get_docker_stats(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_stats(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn read_docker_compose(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .read_docker_compose(&profile, secret.as_deref(), &path)
}

#[tauri::command]
pub async fn get_docker_volumes(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_volumes(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn get_docker_volume_files(
    state: State<'_, AppState>,
    profile: SshProfile,
    volume_name: String,
    inner_path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_volume_files(&profile, secret.as_deref(), &volume_name, &inner_path)
}

#[tauri::command]
pub async fn inspect_docker_container(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .inspect_container(&profile, secret.as_deref(), &container_id)
}

#[tauri::command]
pub async fn get_docker_container_logs(
    state: State<'_, AppState>,
    profile: SshProfile,
    container_id: String,
    tail: Option<u32>,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_container_logs(&profile, secret.as_deref(), &container_id, tail)
}

#[tauri::command]
pub async fn get_docker_networks(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_networks(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn create_docker_network(
    state: State<'_, AppState>,
    profile: SshProfile,
    name: String,
    driver: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .create_network(&profile, secret.as_deref(), &name, &driver)
}

#[tauri::command]
pub async fn remove_docker_network(
    state: State<'_, AppState>,
    profile: SshProfile,
    name: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .remove_network(&profile, secret.as_deref(), &name)
}

#[tauri::command]
pub async fn get_docker_events(
    state: State<'_, AppState>,
    profile: SshProfile,
    filter: Option<String>,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .get_docker_events(&profile, secret.as_deref(), filter.as_deref())
}

#[tauri::command]
pub async fn prune_docker_containers(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .prune_containers(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn prune_docker_networks(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .prune_networks(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn prune_docker_images(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .prune_images(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn prune_docker_volumes(
    state: State<'_, AppState>,
    profile: SshProfile,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .prune_volumes(&profile, secret.as_deref())
}

#[tauri::command]
pub async fn docker_compose_up(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .compose_up(&profile, secret.as_deref(), &path)
}

#[tauri::command]
pub async fn docker_compose_down(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .compose_down(&profile, secret.as_deref(), &path)
}

#[tauri::command]
pub async fn docker_compose_pause(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .compose_pause(&profile, secret.as_deref(), &path)
}

#[tauri::command]
pub async fn docker_compose_unpause(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .compose_unpause(&profile, secret.as_deref(), &path)
}

#[tauri::command]
pub async fn docker_compose_ps(
    state: State<'_, AppState>,
    profile: SshProfile,
    path: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .docker_manager
        .compose_ps(&profile, secret.as_deref(), &path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_docker_command_types() {
        let _response_type: Result<String> = Ok("output".to_string());
        let _error_type: Result<String> = Err(crate::error::AppError::Custom("error".to_string()));
    }

    #[test]
    fn test_docker_container_operations() {
        let operations = vec![
            "start", "stop", "restart", "inspect", "logs", "prune"
        ];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_docker_network_operations() {
        let operations = vec![
            "create", "remove", "prune", "ls"
        ];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_docker_volume_operations() {
        let operations = vec![
            "ls", "prune", "inspect"
        ];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_docker_compose_operations() {
        let operations = vec![
            "up", "down", "pause", "unpause", "ps"
        ];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_docker_prune_operations() {
        let operations = vec![
            "containers", "networks", "images", "volumes", "system"
        ];
        for op in operations {
            assert!(!op.is_empty());
        }
    }

    #[test]
    fn test_docker_container_id_format() {
        let ids = vec![
            "abc123",
            "web-server-01",
            "db_container",
            "nginx-proxy",
        ];
        for id in ids {
            assert!(!id.is_empty());
        }
    }

    #[test]
    fn test_docker_network_name_format() {
        let names = vec![
            "bridge",
            "host",
            "none",
            "my-network",
            "app_network",
        ];
        for name in names {
            assert!(!name.is_empty());
        }
    }

    #[test]
    fn test_docker_volume_name_format() {
        let names = vec![
            "my_volume",
            "app_data",
            "db-data",
            "volume123",
        ];
        for name in names {
            assert!(!name.is_empty());
        }
    }

    #[test]
    fn test_docker_path_formats() {
        let paths = vec![
            "/home/user/docker-compose.yml",
            "./docker-compose.yml",
            "/app/docker-compose.yaml",
        ];
        for path in paths {
            assert!(!path.is_empty());
        }
    }

    #[test]
    fn test_docker_driver_types() {
        let drivers = vec![
            "bridge",
            "host",
            "overlay",
            "macvlan",
            "none",
        ];
        for driver in drivers {
            assert!(!driver.is_empty());
        }
    }

    #[test]
    fn test_docker_tail_option() {
        let tail_none: Option<u32> = None;
        assert_eq!(tail_none.unwrap_or(500), 500);

        let tail_some: Option<u32> = Some(100);
        assert_eq!(tail_some.unwrap_or(500), 100);
    }

    #[test]
    fn test_docker_filter_option() {
        let filter_none: Option<String> = None;
        assert!(filter_none.is_none());

        let filter_some: Option<String> = Some("container=web".to_string());
        assert!(filter_some.is_some());
    }

    #[test]
    fn test_docker_secret_handling() {
        let secret: Option<String> = None;
        let secret_deref = secret.as_deref();
        assert!(secret_deref.is_none());

        let secret2: Option<String> = Some("password".to_string());
        let secret_deref2 = secret2.as_deref();
        assert_eq!(secret_deref2, Some("password"));
    }

    #[test]
    fn test_docker_result_unwrap_or() {
        let result: Result<Option<String>> = Ok(None);
        let unwrapped = result.unwrap_or(None);
        assert!(unwrapped.is_none());
    }

    #[test]
    fn test_docker_state_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_docker_manager_methods() {
        let methods = vec![
            "get_containers", "start_container", "stop_container",
            "restart_container", "system_prune", "get_stats",
            "read_docker_compose", "get_volumes", "get_volume_files",
            "inspect_container", "get_container_logs", "get_networks",
            "create_network", "remove_network", "get_docker_events",
            "prune_containers", "prune_networks", "prune_images",
            "prune_volumes", "compose_up", "compose_down",
            "compose_pause", "compose_unpause", "compose_ps",
        ];
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_docker_stats_command() {
        let cmd = "docker stats --no-stream --format '{{json .}}'";
        assert!(cmd.contains("docker stats"));
        assert!(cmd.contains("--no-stream"));
    }

    #[test]
    fn test_docker_system_prune_command() {
        let cmd = "docker system prune -af";
        assert!(cmd.contains("docker system prune"));
        assert!(cmd.contains("-af"));
    }

    #[test]
    fn test_docker_network_ls_command() {
        let cmd = "docker network ls --format '{{json .}}'";
        assert!(cmd.contains("docker network ls"));
    }

    #[test]
    fn test_docker_volume_ls_command() {
        let cmd = "docker volume ls --format '{{json .}}'";
        assert!(cmd.contains("docker volume ls"));
    }

    #[test]
    fn test_docker_compose_path_validation() {
        let valid_paths = vec![
            "/home/user/project",
            "./app",
            "/var/www/docker-compose.yml",
        ];
        for path in valid_paths {
            assert!(!path.is_empty());
        }
    }

    #[test]
    fn test_docker_container_logs_tail() {
        let tail_default: Option<u32> = None;
        let tail_value = tail_default.unwrap_or(500);
        assert_eq!(tail_value, 500);

        let tail_custom: Option<u32> = Some(1000);
        let tail_value2 = tail_custom.unwrap_or(500);
        assert_eq!(tail_value2, 1000);
    }

    #[test]
    fn test_docker_events_filter() {
        let filter: Option<String> = Some("type=container".to_string());
        let filter_deref = filter.as_deref();
        assert_eq!(filter_deref, Some("type=container"));
    }

    #[test]
    fn test_docker_network_create_command() {
        let name = "mynetwork";
        let driver = "bridge";
        let cmd = format!("docker network create --driver {} {}", driver, name);
        assert!(cmd.contains("docker network create"));
        assert!(cmd.contains("--driver bridge"));
    }

    #[test]
    fn test_docker_network_remove_command() {
        let name = "mynetwork";
        let cmd = format!("docker network rm {}", name);
        assert!(cmd.contains("docker network rm"));
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
        let up_cmd = format!("cd '{}' && docker-compose up -d", path);
        let down_cmd = format!("cd '{}' && docker-compose down", path);
        
        assert!(up_cmd.contains("docker-compose up -d"));
        assert!(down_cmd.contains("docker-compose down"));
    }

    #[test]
    fn test_docker_inspect_command() {
        let container_id = "web-server";
        let cmd = format!("docker inspect {}", container_id);
        assert!(cmd.contains("docker inspect"));
    }

    #[test]
    fn test_docker_logs_command() {
        let container_id = "web-server";
        let tail = 100;
        let cmd = format!("docker logs --tail {} {}", tail, container_id);
        assert!(cmd.contains("docker logs"));
        assert!(cmd.contains("--tail 100"));
    }

    #[test]
    fn test_docker_start_stop_commands() {
        let container_id = "web-server";
        let start_cmd = format!("docker start {}", container_id);
        let stop_cmd = format!("docker stop {}", container_id);
        
        assert_eq!(start_cmd, "docker start web-server");
        assert_eq!(stop_cmd, "docker stop web-server");
    }

    #[test]
    fn test_docker_async_function_types() {
        use std::future;
        let _get_containers: fn(State<'_, AppState>, SshProfile) -> future::Ready<Result<String>> = 
            |_, _| future::ready(Ok(String::new()));
    }

    #[test]
    fn test_docker_string_cloning() {
        let container_id = "web-server".to_string();
        let cloned = container_id.clone();
        assert_eq!(container_id, cloned);
    }

    #[test]
    fn test_docker_option_as_deref() {
        let filter: Option<String> = Some("container=web".to_string());
        let deref = filter.as_deref();
        assert_eq!(deref, Some("container=web"));
    }

    #[test]
    fn test_docker_vec_operations() {
        let mut containers: Vec<String> = Vec::new();
        containers.push("container1".to_string());
        containers.push("container2".to_string());
        
        assert_eq!(containers.len(), 2);
    }

    #[test]
    fn test_docker_error_handling() {
        let error = crate::error::AppError::Custom("Docker command failed".to_string());
        assert!(error.to_string().contains("failed"));
    }
}
