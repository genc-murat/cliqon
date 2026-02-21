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
        .setup(|app| {
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
            rename_sftp,
            delete_sftp,
            stat_sftp,
            chmod_sftp,
            read_sftp_file,
            write_sftp_file,
            sudo_read_file,
            sudo_write_file,
            close_sftp,
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
            get_system_services,
            manage_service,
            start_log_tail,
            stop_log_tail,
            start_sharing,
            stop_sharing,
            get_sharing_status,
            set_sharing_display_name,
            get_discovered_peers,
            share_profiles_with_peer,
            get_pending_shares,
            accept_share,
            reject_share
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

