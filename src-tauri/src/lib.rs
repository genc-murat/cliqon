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
use tauri::Manager;

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_profiles,
            save_profile,
            delete_profile,
            get_profile_secret,
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
            get_docker_volume_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
