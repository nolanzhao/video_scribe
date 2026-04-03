mod audio;
mod commands;
mod model_manager;
mod transcriber;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::check_model_status,
            commands::download_model,
            commands::check_ffmpeg,
            commands::download_ffmpeg,
            commands::transcribe_video,
            commands::save_file,
            commands::open_containing_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
