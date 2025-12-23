use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Application settings persisted to disk
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Path to the Cataclysm-BN game directory
    pub game_path: Option<String>,
    /// Selected tileset name
    pub tileset: Option<String>,
    /// Additional directories containing mods
    #[serde(default)]
    pub mod_directories: Vec<String>,
}

/// Get the settings file path
fn settings_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .expect("Failed to get config dir")
        .join("settings.json")
}

/// Load settings from disk
#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app);

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    Ok(settings)
}

/// Save settings to disk
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app);

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

/// Check if a directory contains a Cataclysm-BN binary
fn has_bn_binary(path: &Path) -> bool {
    // Check for various binary names across platforms
    let binary_names = [
        "cataclysm-bn-tiles",
        "cataclysm-bn-tiles.exe",
        "cataclysm-bn",
        "cataclysm-bn.exe",
        "cataclysm-tiles",
        "cataclysm-tiles.exe",
    ];

    for name in binary_names {
        if path.join(name).exists() {
            return true;
        }
    }
    false
}

/// Validate a game path - check if it looks like a BN installation
#[tauri::command]
pub fn validate_game_path(path: String) -> Result<GamePathInfo, String> {
    let path = PathBuf::from(&path);

    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    // Check for data/json directory (exists in both repo and installed game)
    let data_json = path.join("data").join("json");
    if !data_json.exists() {
        // Maybe it's a .app bundle on macOS?
        let app_data_json = path.join("Contents").join("Resources").join("data").join("json");
        if app_data_json.exists() {
            let resources_path = path.join("Contents").join("Resources");
            return Ok(GamePathInfo {
                valid: true,
                path_type: "macos_app".to_string(),
                data_path: resources_path.to_string_lossy().to_string(),
                is_bn_root: has_bn_binary(&resources_path) || path.join("Contents").join("MacOS").join("cataclysm-bn-tiles").exists(),
            });
        }
        return Err("Not a valid Cataclysm-BN directory (missing data/json)".to_string());
    }

    // Determine if this is a repo or installed game
    let is_repo = path.join(".git").exists() || path.join("src").exists();
    let is_bn_root = has_bn_binary(&path) || is_repo;

    Ok(GamePathInfo {
        valid: true,
        path_type: if is_repo { "repository" } else { "installed" }.to_string(),
        data_path: path.to_string_lossy().to_string(),
        is_bn_root,
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GamePathInfo {
    pub valid: bool,
    pub path_type: String,
    pub data_path: String,
    /// True if this is a BN root directory (has binary or is repo)
    pub is_bn_root: bool,
}
