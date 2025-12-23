use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::models::{PackId, PackLoadResult, PackMetadata, WorkspaceState};
use crate::services::loader;
use crate::AppState;

/// Info about an available mod (not yet loaded)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableModInfo {
    /// Path to the mod directory
    pub path: PathBuf,
    /// Metadata from modinfo.json
    pub metadata: PackMetadata,
}

/// Load a content pack from disk
#[tauri::command]
pub async fn load_content_pack(
    state: State<'_, AppState>,
    path: PathBuf,
    read_only: bool,
    name_override: Option<String>,
    exclude_dirs: Option<Vec<String>>,
    is_base_game: Option<bool>,
) -> Result<PackLoadResult, String> {
    let is_base_game = is_base_game.unwrap_or(false);

    // Load the pack
    let result = loader::load_content_pack(&path, read_only, name_override.clone(), exclude_dirs.clone(), is_base_game)
        .map_err(|e| e.to_string())?;

    // Create the full pack and store it
    let pack = loader::create_pack_from_result(&result, &path, read_only, name_override, exclude_dirs, is_base_game);

    {
        let mut workspace = state.workspace.lock().map_err(|e| e.to_string())?;
        workspace.packs.insert(result.pack_id, pack);
        workspace.load_order.push(result.pack_id);
    }

    Ok(result)
}

/// Get current workspace state
#[tauri::command]
pub fn get_workspace_state(state: State<'_, AppState>) -> Result<WorkspaceState, String> {
    let workspace = state.workspace.lock().map_err(|e| e.to_string())?;
    Ok(workspace.to_state())
}

/// Close/unload a content pack
#[tauri::command]
pub fn close_pack(
    state: State<'_, AppState>,
    pack_id: PackId,
    force: bool,
) -> Result<(), String> {
    let mut workspace = state.workspace.lock().map_err(|e| e.to_string())?;

    // Check if pack exists
    let pack = workspace
        .packs
        .get(&pack_id)
        .ok_or_else(|| format!("Pack {} not found", pack_id))?;

    // Check for unsaved changes
    if !force && !pack.dirty_files.is_empty() {
        return Err(format!(
            "Pack has {} unsaved files. Use force=true to close anyway.",
            pack.dirty_files.len()
        ));
    }

    // Remove from workspace
    workspace.packs.remove(&pack_id);
    workspace.load_order.retain(|id| *id != pack_id);

    Ok(())
}

/// Reload a pack from disk (discarding unsaved changes)
#[tauri::command]
pub async fn reload_pack(
    state: State<'_, AppState>,
    pack_id: PackId,
) -> Result<PackLoadResult, String> {
    let (path, read_only) = {
        let workspace = state.workspace.lock().map_err(|e| e.to_string())?;
        let pack = workspace
            .packs
            .get(&pack_id)
            .ok_or_else(|| format!("Pack {} not found", pack_id))?;
        (pack.path.clone(), pack.read_only)
    };

    // Reload the pack
    // TODO: Store exclude_dirs and is_base_game in pack for proper reload support
    let result = loader::load_content_pack(&path, read_only, None, None, false)
        .map_err(|e| e.to_string())?;

    // Create the full pack and replace it
    let pack = loader::create_pack_from_result(&result, &path, read_only, None, None, false);

    {
        let mut workspace = state.workspace.lock().map_err(|e| e.to_string())?;
        workspace.packs.insert(pack_id, pack);
    }

    // Return result with original pack_id
    Ok(PackLoadResult {
        pack_id,
        ..result
    })
}

/// List all available mods in the game's mods directory
#[tauri::command]
pub fn list_available_mods(game_path: &str) -> Result<Vec<AvailableModInfo>, String> {
    let mods_path = Path::new(game_path).join("data").join("mods");
    list_mods_in_directory(mods_path.to_string_lossy().as_ref())
}

/// List all mods in a given directory
/// Excludes "bn" directory as that's the base game metadata, not a separate mod
#[tauri::command]
pub fn list_mods_in_directory(dir_path: &str) -> Result<Vec<AvailableModInfo>, String> {
    let mods_path = Path::new(dir_path);

    if !mods_path.exists() {
        return Err(format!("Directory not found: {:?}", mods_path));
    }

    let mut mods = Vec::new();

    let entries = fs::read_dir(&mods_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Skip "bn" directory - it's the base game metadata, not a separate mod
            if path.file_name().map_or(false, |n| n == "bn") {
                continue;
            }

            // Check if this directory has a modinfo.json
            if let Some(metadata) = loader::load_pack_metadata(&path) {
                mods.push(AvailableModInfo { path, metadata });
            }
        }
    }

    // Sort by name/id
    mods.sort_by(|a, b| {
        let name_a = a.metadata.mod_id.as_deref().unwrap_or("");
        let name_b = b.metadata.mod_id.as_deref().unwrap_or("");
        name_a.cmp(name_b)
    });

    Ok(mods)
}
