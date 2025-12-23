use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::models::{
    ContentPack, Entity, EntityKey, LoadStats, PackLoadResult, PackMetadata,
};

/// Load a content pack from a directory path
/// `exclude_dirs` - optional list of directory names to skip during recursive walk
/// `is_base_game` - if true, looks for metadata in mods/bn/modinfo.json as fallback
pub fn load_content_pack(
    path: &Path,
    read_only: bool,
    name_override: Option<String>,
    exclude_dirs: Option<Vec<String>>,
    is_base_game: bool,
) -> Result<PackLoadResult, LoadError> {
    let path = path.canonicalize().map_err(|e| LoadError::IoError {
        path: path.to_path_buf(),
        message: e.to_string(),
    })?;

    let pack_id = Uuid::new_v4();
    let name = name_override.unwrap_or_else(|| detect_pack_name(&path));
    let metadata = if is_base_game {
        load_pack_metadata_for_base_game(&path)
    } else {
        load_pack_metadata(&path)
    };

    let mut pack = ContentPack::new(pack_id, name.clone(), path.clone(), read_only);
    pack.metadata = metadata;

    let mut stats = LoadStats {
        files_scanned: 0,
        entities_loaded: 0,
        errors: Vec::new(),
    };

    // Find all JSON files in the pack
    let json_files = find_json_files(&path, exclude_dirs.as_deref());
    stats.files_scanned = json_files.len();

    // Load entities from each file
    for file_path in json_files {
        match load_entities_from_file(&file_path, &path) {
            Ok(entities) => {
                for entity in entities {
                    let key = entity.key();
                    // Handle duplicate keys by appending source file info
                    let unique_key = if pack.entities.contains_key(&key) {
                        make_unique_key(&key, &entity.source_file, &pack.entities)
                    } else {
                        key
                    };
                    pack.entities.insert(unique_key, entity);
                    stats.entities_loaded += 1;
                }
            }
            Err(e) => {
                stats.errors.push(format!("{}: {}", file_path.display(), e));
            }
        }
    }

    let entity_tree = pack.to_entity_tree();

    Ok(PackLoadResult {
        pack_id,
        name,
        entity_tree,
        load_stats: stats,
    })
}

/// Get the loaded pack from the result
pub fn create_pack_from_result(
    result: &PackLoadResult,
    path: &Path,
    read_only: bool,
    name_override: Option<String>,
    exclude_dirs: Option<Vec<String>>,
    is_base_game: bool,
) -> ContentPack {
    let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let metadata = if is_base_game {
        load_pack_metadata_for_base_game(&path)
    } else {
        load_pack_metadata(&path)
    };
    let name = name_override.unwrap_or_else(|| result.name.clone());
    let mut pack = ContentPack::new(result.pack_id, name, path.clone(), read_only);
    pack.metadata = metadata;

    // Reload entities (we need to do this again since PackLoadResult doesn't contain full entities)
    let json_files = find_json_files(&path, exclude_dirs.as_deref());
    for file_path in json_files {
        if let Ok(entities) = load_entities_from_file(&file_path, &path) {
            for entity in entities {
                let key = entity.key();
                let unique_key = if pack.entities.contains_key(&key) {
                    make_unique_key(&key, &entity.source_file, &pack.entities)
                } else {
                    key
                };
                pack.entities.insert(unique_key, entity);
            }
        }
    }

    pack
}

/// Detect the pack name from the directory or modinfo.json
fn detect_pack_name(path: &Path) -> String {
    // Try to read modinfo.json for the mod name
    let modinfo_path = path.join("modinfo.json");
    if modinfo_path.exists() {
        if let Ok(content) = fs::read_to_string(&modinfo_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                // modinfo.json can be an array or object
                let info = if json.is_array() {
                    json.as_array().and_then(|arr| arr.first())
                } else {
                    Some(&json)
                };

                if let Some(info) = info {
                    if let Some(name) = info.get("name").and_then(|v| v.as_str()) {
                        return name.to_string();
                    }
                }
            }
        }
    }

    // Fall back to directory name
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown Pack")
        .to_string()
}

/// Load pack metadata from modinfo.json
pub fn load_pack_metadata(path: &Path) -> Option<PackMetadata> {
    load_pack_metadata_impl(path, false)
}

/// Load pack metadata, with special handling for base game
/// When is_base_game is true, checks mods/bn/modinfo.json as fallback
pub fn load_pack_metadata_for_base_game(path: &Path) -> Option<PackMetadata> {
    load_pack_metadata_impl(path, true)
}

fn load_pack_metadata_impl(path: &Path, is_base_game: bool) -> Option<PackMetadata> {
    let modinfo_path = path.join("modinfo.json");

    // Try direct modinfo.json first
    let metadata_path = if modinfo_path.exists() {
        modinfo_path
    } else if is_base_game {
        // For base game only: check mods/bn/modinfo.json
        let bn_modinfo = path.join("mods").join("bn").join("modinfo.json");
        if bn_modinfo.exists() {
            bn_modinfo
        } else {
            return None;
        }
    } else {
        return None;
    };

    let content = fs::read_to_string(&metadata_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    // modinfo.json can be an array or object
    let info = if json.is_array() {
        json.as_array()?.first()?.clone()
    } else {
        json
    };

    // Parse authors - can be a string or array
    let authors = match info.get("authors") {
        Some(serde_json::Value::String(s)) => vec![s.clone()],
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        _ => Vec::new(),
    };

    Some(PackMetadata {
        mod_id: info.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        mod_type: info.get("type").and_then(|v| v.as_str()).map(|s| s.to_string()),
        dependencies: info
            .get("dependencies")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        description: info
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        version: info
            .get("version")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        lua_api_version: info
            .get("lua_api_version")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        authors,
        category: info
            .get("category")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

/// Find all JSON files in a directory recursively
/// `exclude_dirs` - optional slice of directory names to skip during walk
fn find_json_files(path: &Path, exclude_dirs: Option<&[String]>) -> Vec<PathBuf> {
    let mut files = Vec::new();

    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            // Skip excluded directories if specified
            if let Some(excludes) = exclude_dirs {
                if e.file_type().is_dir() {
                    if let Some(name) = e.file_name().to_str() {
                        return !excludes.iter().any(|ex| ex == name);
                    }
                }
            }
            true
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            // Skip modinfo.json as it's metadata, not entity data
            if path.file_name().map_or(false, |n| n != "modinfo.json") {
                files.push(path.to_path_buf());
            }
        }
    }

    files
}

/// Load all entities from a single JSON file
fn load_entities_from_file(
    file_path: &Path,
    pack_root: &Path,
) -> Result<Vec<Entity>, LoadError> {
    let content = fs::read_to_string(file_path).map_err(|e| LoadError::IoError {
        path: file_path.to_path_buf(),
        message: e.to_string(),
    })?;

    let json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| LoadError::ParseError {
            path: file_path.to_path_buf(),
            message: e.to_string(),
        })?;

    let relative_path = file_path
        .strip_prefix(pack_root)
        .unwrap_or(file_path)
        .to_path_buf();

    // BN JSON files are always arrays of objects
    let array = json.as_array().ok_or_else(|| LoadError::ParseError {
        path: file_path.to_path_buf(),
        message: "Expected JSON array at root".to_string(),
    })?;

    let mut entities = Vec::new();

    for (index, value) in array.iter().enumerate() {
        // Skip non-objects
        if !value.is_object() {
            continue;
        }

        // Try to create an entity from this object
        if let Some(entity) = Entity::from_json(value.clone(), relative_path.clone(), index) {
            entities.push(entity);
        }
        // Silently skip objects that don't have type/id (e.g., comments or other metadata)
    }

    Ok(entities)
}

/// Make a unique key by appending file info
fn make_unique_key(
    base_key: &str,
    source_file: &Path,
    existing: &HashMap<EntityKey, Entity>,
) -> EntityKey {
    let file_stem = source_file
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let mut key = format!("{}@{}", base_key, file_stem);
    let mut counter = 1;

    while existing.contains_key(&key) {
        key = format!("{}@{}_{}", base_key, file_stem, counter);
        counter += 1;
    }

    key
}

#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("IO error reading {path}: {message}")]
    IoError { path: PathBuf, message: String },

    #[error("Parse error in {path}: {message}")]
    ParseError { path: PathBuf, message: String },
}
