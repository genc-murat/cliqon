pub mod error;
pub mod models;
pub mod commands;
pub mod state;
pub mod services;

use state::app_state::AppState;
use commands::profile::*;
use commands::terminal::*;
use commands::sftp::*;
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
            close_sftp
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
