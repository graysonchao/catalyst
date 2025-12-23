use std::sync::Mutex;

mod commands;
mod models;
mod services;

pub use models::Workspace;

/// Application state shared across all commands
pub struct AppState {
    pub workspace: Mutex<Workspace>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            workspace: Mutex::new(Workspace::default()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            commands::workspace::load_content_pack,
            commands::workspace::get_workspace_state,
            commands::workspace::close_pack,
            commands::workspace::reload_pack,
            commands::workspace::list_available_mods,
            commands::workspace::list_mods_in_directory,
            // Entity commands
            commands::entity::get_entity,
            commands::entity::update_entity,
            commands::entity::search_entities,
            // File commands
            commands::file::save_pack,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::validate_game_path,
            // Tileset commands
            commands::tileset::list_tilesets,
            commands::tileset::load_tileset_config,
            commands::tileset::load_tileset_image,
            // Terrain/furniture commands
            commands::terrain::list_terrain_types,
            commands::terrain::list_furniture_types,
            // Palette commands
            commands::palette::load_palette,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
