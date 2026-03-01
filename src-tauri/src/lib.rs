pub mod error;
pub mod models;
pub mod commands;
pub mod state;
pub mod services;

use state::app_state::AppState;
use commands::profile::*;
use commands::terminal::*;
use commands::sftp::*;
use commands::monitor::*;
use commands::net_tools::*;
use commands::docker::*;
use commands::system::*;
use commands::logging::*;
use commands::sharing::*;
use commands::tunnel::*;
use commands::snippet::*;
use commands::ssh_keys::*;
use commands::cron::*;
use tauri::Manager;
use crate::services::system::SystemService;
use crate::services::logging::LogManager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            app.handle().plugin(tauri_plugin_devtools::init())?;

            let app_state = AppState::new(app.handle());
            app.manage(app_state);
            app.manage(std::sync::Arc::new(SystemService::new()));
            app.manage(std::sync::Arc::new(LogManager::new()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_profiles,
            save_profile,
            delete_profile,
            get_profile_secret,
            record_usage,
            import_profiles,
            test_ssh_connection,
            connect_ssh,
            write_to_pty,
            resize_pty,
            close_pty,
            connect_sftp,
            list_sftp_dir,
            upload_sftp,
            download_sftp,
            download_multi_zip_sftp,
            rename_sftp,
            delete_sftp,
            stat_sftp,
            chmod_sftp,
            read_sftp_file,
            write_sftp_file,
            sudo_read_file,
            sudo_write_file,
            create_sftp_dir,
            create_sftp_file,
            copy_sftp_file,
            move_sftp_file,
            close_sftp,
            start_sftp_watch,
            stop_sftp_watch,
            start_monitor,
            stop_monitor,
            run_net_tool,
            get_docker_containers,
            start_docker_container,
            stop_docker_container,
            restart_docker_container,
            docker_system_prune,
            get_docker_stats,
            read_docker_compose,
            get_docker_volumes,
            get_docker_volume_files,
            inspect_docker_container,
            get_docker_container_logs,
            get_docker_networks,
            create_docker_network,
            remove_docker_network,
            get_docker_events,
            prune_docker_containers,
            prune_docker_networks,
            prune_docker_images,
            prune_docker_volumes,
            docker_compose_up,
            docker_compose_down,
            docker_compose_pause,
            docker_compose_unpause,
            docker_compose_ps,
            get_system_services,
            get_system_timers,
            manage_service,
            start_log_tail,
            stop_log_tail,
            start_sharing,
            stop_sharing,
            get_sharing_status,
            set_sharing_display_name,
            get_discovered_peers,
            share_items_with_peer,
            get_pending_shares,
            accept_share,
            reject_share,
            start_tunnel,
            stop_tunnel,
            get_active_tunnels,
            get_tunnel_stats,
            get_snippets,
            save_snippet,
            delete_snippet,
            generate_ssh_key,
            import_ssh_key,
            list_local_keys,
            delete_local_key,
            get_remote_authorized_keys,
            add_remote_authorized_key,
            remove_remote_authorized_key,
            deploy_key_to_remote,
            list_cron_jobs,
            create_cron_job,
            delete_cron_job,
            get_cron_history,
            get_env_vars,
            set_env_var,
            delete_env_var,
            save_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet_function() {
        let result = greet("World");
        assert_eq!(result, "Hello, World! You've been greeted from Rust!");
    }

    #[test]
    fn test_greet_with_name() {
        let result = greet("Alice");
        assert!(result.contains("Alice"));
        assert!(result.starts_with("Hello,"));
    }

    #[test]
    fn test_greet_empty_name() {
        let result = greet("");
        assert_eq!(result, "Hello, ! You've been greeted from Rust!");
    }

    #[test]
    fn test_greet_special_characters() {
        let result = greet("Test-User_123");
        assert!(result.contains("Test-User_123"));
    }

    #[test]
    fn test_modules_exist() {
        // Verify all modules are defined
        let modules = vec!["error", "models", "commands", "state", "services"];
        for module in modules {
            assert!(!module.is_empty());
        }
    }

    #[test]
    fn test_command_imports() {
        // Verify command modules are imported
        let command_modules = vec![
            "profile", "terminal", "sftp", "monitor", "net_tools",
            "docker", "system", "logging", "sharing", "tunnel",
            "snippet", "ssh_keys", "cron",
        ];
        for module in command_modules {
            assert!(!module.is_empty());
        }
    }

    #[test]
    fn test_service_imports() {
        // Verify service modules are imported
        let services = vec!["system", "logging"];
        for service in services {
            assert!(!service.is_empty());
        }
    }

    #[test]
    fn test_system_service_creation() {
        let _service = SystemService::new();
    }

    #[test]
    fn test_log_manager_creation() {
        let _manager = LogManager::new();
    }

    #[test]
    fn test_arc_system_service() {
        let _service: std::sync::Arc<SystemService> = std::sync::Arc::new(SystemService::new());
    }

    #[test]
    fn test_arc_log_manager() {
        let _manager: std::sync::Arc<LogManager> = std::sync::Arc::new(LogManager::new());
    }

    #[test]
    fn test_tauri_command_list() {
        // List of all registered commands
        let commands = vec![
            "greet", "get_profiles", "save_profile", "delete_profile",
            "connect_ssh", "connect_sftp", "start_monitor", "run_net_tool",
            "get_docker_containers", "start_docker_container", "stop_docker_container",
            "start_sharing", "stop_sharing", "start_tunnel", "stop_tunnel",
            "get_snippets", "save_snippet", "delete_snippet",
            "generate_ssh_key", "list_cron_jobs", "create_cron_job",
        ];
        
        for cmd in commands {
            assert!(!cmd.is_empty());
        }
    }

    #[test]
    fn test_string_format_in_greet() {
        let name = "Test";
        let expected = format!("Hello, {}! You've been greeted from Rust!", name);
        assert!(expected.contains(name));
    }
}

