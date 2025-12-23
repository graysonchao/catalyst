use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Information about an available tileset
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TilesetInfo {
    pub name: String,
    pub path: String,
}

/// Tile configuration for a single tile
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TileEntry {
    pub id: StringOrArray,
    pub fg: Option<SpriteIndex>,
    pub bg: Option<SpriteIndex>,
    #[serde(default)]
    pub multitile: bool,
    pub additional_tiles: Option<Vec<AdditionalTile>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StringOrArray {
    Single(String),
    Multiple(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SpriteIndex {
    Single(i32),
    Rotated(Vec<i32>),
    Weighted(Vec<WeightedSprite>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightedSprite {
    pub weight: i32,
    pub sprite: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdditionalTile {
    pub id: String,
    pub fg: Option<SpriteIndex>,
    pub bg: Option<SpriteIndex>,
}

/// A sprite sheet within a tileset
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpriteSheet {
    pub file: String,
    pub sprite_width: u32,
    pub sprite_height: u32,
    pub sprite_offset_x: i32,
    pub sprite_offset_y: i32,
}

/// Simplified tile mapping for frontend use
/// fg/bg are LOCAL indices within the sprite sheet (converted from global)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TileMapping {
    pub id: String,
    pub fg: Option<i32>,
    pub bg: Option<i32>,
    pub file: String,
}

/// Tracks sprite sheet ranges for global-to-local index conversion
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct SpriteSheetRange {
    file: String,
    start_index: i32,
    end_index: i32, // exclusive
    sprite_width: u32,
    sprite_height: u32,
}

/// Full tileset configuration
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TilesetConfig {
    pub name: String,
    pub tile_width: u32,
    pub tile_height: u32,
    pub sprite_sheets: Vec<SpriteSheet>,
    pub mappings: HashMap<String, TileMapping>,
}

/// List available tilesets in game gfx/ directory
#[tauri::command]
pub fn list_tilesets(game_path: &str) -> Result<Vec<TilesetInfo>, String> {
    let gfx_path = Path::new(game_path).join("gfx");

    if !gfx_path.exists() {
        return Err(format!("gfx directory not found at {:?}", gfx_path));
    }

    let mut tilesets = Vec::new();

    let entries =
        fs::read_dir(&gfx_path).map_err(|e| format!("Failed to read gfx directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Check if this directory contains a tile_config.json
            let config_path = path.join("tile_config.json");
            if config_path.exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    tilesets.push(TilesetInfo {
                        name: name.to_string(),
                        path: name.to_string(),
                    });
                }
            }
        }
    }

    // Sort by name
    tilesets.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(tilesets)
}

/// Get PNG image dimensions by reading the IHDR chunk
fn get_png_dimensions(path: &Path) -> Result<(u32, u32), String> {
    let bytes = fs::read(path).map_err(|e| format!("Failed to read PNG {:?}: {}", path, e))?;

    // PNG signature is 8 bytes, then IHDR chunk
    // IHDR: 4 bytes length + 4 bytes "IHDR" + 4 bytes width + 4 bytes height + ...
    if bytes.len() < 24 {
        return Err("PNG file too small".to_string());
    }

    // Check PNG signature
    if &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("Invalid PNG signature".to_string());
    }

    // Width and height are at bytes 16-19 and 20-23 (big-endian)
    let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
    let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);

    Ok((width, height))
}

/// Load tileset configuration (tile_config.json)
///
/// This implements the same algorithm as Cataclysm-BN's tileset loader:
/// 1. For each sprite sheet, calculate sprite count = (img_width / sprite_width) * (img_height / sprite_height)
/// 2. Track cumulative offset across all sheets
/// 3. fg/bg values in JSON are GLOBAL indices; convert to local by subtracting sheet's start offset
#[tauri::command]
pub fn load_tileset_config(game_path: &str, tileset_name: &str) -> Result<TilesetConfig, String> {
    let tileset_dir = Path::new(game_path).join("gfx").join(tileset_name);
    let config_path = tileset_dir.join("tile_config.json");

    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;

    let json: Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

    // Extract tile_info
    let tile_info = json
        .get("tile_info")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .ok_or("Missing tile_info")?;

    let tile_width = tile_info
        .get("width")
        .and_then(|v| v.as_u64())
        .unwrap_or(32) as u32;
    let tile_height = tile_info
        .get("height")
        .and_then(|v| v.as_u64())
        .unwrap_or(32) as u32;

    let mut sprite_sheets = Vec::new();
    let mut sheet_ranges: Vec<SpriteSheetRange> = Vec::new();
    let mut mappings = HashMap::new();

    // Process tiles-new format
    if let Some(tiles_new) = json.get("tiles-new").and_then(|v| v.as_array()) {
        // First pass: calculate sprite counts and build offset ranges
        let mut current_offset: i32 = 0;

        for sheet in tiles_new {
            let file = sheet
                .get("file")
                .and_then(|v| v.as_str())
                .unwrap_or("normal.png")
                .to_string();

            let sprite_width = sheet
                .get("sprite_width")
                .and_then(|v| v.as_u64())
                .unwrap_or(tile_width as u64) as u32;
            let sprite_height = sheet
                .get("sprite_height")
                .and_then(|v| v.as_u64())
                .unwrap_or(tile_height as u64) as u32;
            let sprite_offset_x = sheet
                .get("sprite_offset_x")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            let sprite_offset_y = sheet
                .get("sprite_offset_y")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;

            // Get image dimensions to calculate sprite count
            let image_path = tileset_dir.join(&file);
            let (img_width, img_height) = get_png_dimensions(&image_path).unwrap_or((0, 0));

            let sprite_count = if sprite_width > 0 && sprite_height > 0 {
                ((img_width / sprite_width) * (img_height / sprite_height)) as i32
            } else {
                0
            };

            sprite_sheets.push(SpriteSheet {
                file: file.clone(),
                sprite_width,
                sprite_height,
                sprite_offset_x,
                sprite_offset_y,
            });

            sheet_ranges.push(SpriteSheetRange {
                file: file.clone(),
                start_index: current_offset,
                end_index: current_offset + sprite_count,
                sprite_width,
                sprite_height,
            });

            current_offset += sprite_count;
        }

        // Second pass: parse tiles and convert global indices to local
        for sheet in tiles_new {
            if let Some(tiles) = sheet.get("tiles").and_then(|v| v.as_array()) {
                for tile in tiles {
                    let ids = match tile.get("id") {
                        Some(Value::String(s)) => vec![s.clone()],
                        Some(Value::Array(arr)) => arr
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect(),
                        _ => continue,
                    };

                    let global_fg = extract_first_sprite_index(tile.get("fg"));
                    let global_bg = extract_first_sprite_index(tile.get("bg"));

                    // Find which sheet this tile belongs to and convert to local index
                    let (local_fg, fg_file) = convert_global_to_local(global_fg, &sheet_ranges);
                    let (local_bg, bg_file) = convert_global_to_local(global_bg, &sheet_ranges);

                    // Use fg's file as primary, fall back to bg's file
                    let file = fg_file.or(bg_file).unwrap_or_default();

                    for id in ids {
                        mappings.insert(
                            id.clone(),
                            TileMapping {
                                id,
                                fg: local_fg,
                                bg: local_bg,
                                file: file.clone(),
                            },
                        );
                    }
                }
            }
        }
    }

    Ok(TilesetConfig {
        name: tileset_name.to_string(),
        tile_width,
        tile_height,
        sprite_sheets,
        mappings,
    })
}

/// Convert a global sprite index to a local index within the appropriate sprite sheet
fn convert_global_to_local(
    global_index: Option<i32>,
    ranges: &[SpriteSheetRange],
) -> (Option<i32>, Option<String>) {
    let global = match global_index {
        Some(idx) if idx >= 0 => idx,
        _ => return (None, None),
    };

    for range in ranges {
        if global >= range.start_index && global < range.end_index {
            let local = global - range.start_index;
            return (Some(local), Some(range.file.clone()));
        }
    }

    // Index out of range - return None
    (None, None)
}

/// Extract first sprite index from various formats
fn extract_first_sprite_index(value: Option<&Value>) -> Option<i32> {
    match value {
        Some(Value::Number(n)) => n.as_i64().map(|v| v as i32),
        Some(Value::Array(arr)) => {
            // Could be rotated [n, n, n, n] or weighted [{weight, sprite}, ...]
            if let Some(first) = arr.first() {
                if let Some(n) = first.as_i64() {
                    return Some(n as i32);
                }
                if let Some(obj) = first.as_object() {
                    return obj.get("sprite").and_then(|v| v.as_i64()).map(|v| v as i32);
                }
            }
            None
        }
        _ => None,
    }
}

/// Load a PNG sprite sheet as base64
#[tauri::command]
pub fn load_tileset_image(
    game_path: &str,
    tileset_name: &str,
    image_file: &str,
) -> Result<String, String> {
    let image_path = Path::new(game_path)
        .join("gfx")
        .join(tileset_name)
        .join(image_file);

    let bytes =
        fs::read(&image_path).map_err(|e| format!("Failed to read image {:?}: {}", image_path, e))?;

    Ok(STANDARD.encode(&bytes))
}
