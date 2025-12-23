use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::State;
use walkdir::WalkDir;

use crate::AppState;

/// A symbol mapping in a palette
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolMapping {
    pub symbol: String,
    pub terrain: Option<String>,
    pub furniture: Option<String>,
}

/// Palette data
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteData {
    pub id: String,
    pub mappings: Vec<SymbolMapping>,
    /// IDs of other palettes this one includes
    pub includes: Vec<String>,
}

/// Load an external palette by ID
/// Searches both game data and loaded mod packs
#[tauri::command]
pub fn load_palette(
    state: State<'_, AppState>,
    game_path: &str,
    palette_id: &str,
) -> Result<PaletteData, String> {
    // First try to find in loaded packs
    {
        let workspace = state.workspace.lock().map_err(|e| e.to_string())?;
        for pack in workspace.packs.values() {
            // Check if this pack has the palette
            let key = format!("palette:{}", palette_id);
            if let Some(entity) = pack.entities.get(&key) {
                return parse_palette_json(&entity.json, palette_id);
            }
        }
    }

    // Fall back to searching game data
    let data_path = Path::new(game_path).join("data").join("json");
    if data_path.exists() {
        for entry in WalkDir::new(&data_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
        {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(palette) = find_palette_in_json(&json, palette_id) {
                        return parse_palette_json(&palette, palette_id);
                    }
                }
            }
        }
    }

    Err(format!("Palette '{}' not found", palette_id))
}

fn find_palette_in_json(json: &Value, palette_id: &str) -> Option<Value> {
    match json {
        Value::Array(arr) => {
            for item in arr {
                if let Some(found) = find_palette_in_json(item, palette_id) {
                    return Some(found);
                }
            }
            None
        }
        Value::Object(obj) => {
            if obj.get("type").and_then(|v| v.as_str()) == Some("palette") {
                if obj.get("id").and_then(|v| v.as_str()) == Some(palette_id) {
                    return Some(json.clone());
                }
            }
            None
        }
        _ => None,
    }
}

fn parse_palette_json(json: &Value, palette_id: &str) -> Result<PaletteData, String> {
    let obj = json
        .as_object()
        .ok_or_else(|| "Palette is not an object".to_string())?;

    let mut all_symbols: HashMap<String, SymbolMapping> = HashMap::new();

    // Extract terrain mappings
    if let Some(terrain) = obj.get("terrain").and_then(|v| v.as_object()) {
        for (symbol, value) in terrain {
            let terrain_id = extract_first_id(value);
            all_symbols
                .entry(symbol.clone())
                .or_insert_with(|| SymbolMapping {
                    symbol: symbol.clone(),
                    terrain: None,
                    furniture: None,
                })
                .terrain = terrain_id;
        }
    }

    // Extract furniture mappings
    if let Some(furniture) = obj.get("furniture").and_then(|v| v.as_object()) {
        for (symbol, value) in furniture {
            let furniture_id = extract_first_id(value);
            all_symbols
                .entry(symbol.clone())
                .or_insert_with(|| SymbolMapping {
                    symbol: symbol.clone(),
                    terrain: None,
                    furniture: None,
                })
                .furniture = furniture_id;
        }
    }

    // Convert to sorted vector
    let mut mappings: Vec<_> = all_symbols.into_values().collect();
    mappings.sort_by(|a, b| a.symbol.cmp(&b.symbol));

    // Extract palette includes
    let includes = obj
        .get("palettes")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(PaletteData {
        id: palette_id.to_string(),
        mappings,
        includes,
    })
}

/// Extract first ID from terrain/furniture value
/// Can be: "t_floor", ["t_floor", "t_grass"], [["t_floor", 2], "t_grass"]
fn extract_first_id(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Array(arr) => {
            if let Some(first) = arr.first() {
                match first {
                    Value::String(s) => Some(s.clone()),
                    Value::Array(inner) => {
                        // Weighted: ["t_floor", 2]
                        inner.first().and_then(|v| v.as_str()).map(|s| s.to_string())
                    }
                    _ => None,
                }
            } else {
                None
            }
        }
        _ => None,
    }
}
