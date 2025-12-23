use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Information about a terrain type
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainInfo {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub color: String,
}

/// Information about a furniture type
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FurnitureInfo {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub color: String,
}

/// List all terrain types from game data
#[tauri::command]
pub fn list_terrain_types(game_path: &str) -> Result<Vec<TerrainInfo>, String> {
    let data_path = Path::new(game_path).join("data").join("json");

    if !data_path.exists() {
        return Err(format!("data/json directory not found at {:?}", data_path));
    }

    let mut terrains = Vec::new();

    // Walk through all JSON files looking for terrain definitions
    for entry in WalkDir::new(&data_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
    {
        if let Ok(content) = fs::read_to_string(entry.path()) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                extract_terrain_from_json(&json, &mut terrains);
            }
        }
    }

    // Sort by ID
    terrains.sort_by(|a, b| a.id.cmp(&b.id));
    terrains.dedup_by(|a, b| a.id == b.id);

    Ok(terrains)
}

/// List all furniture types from game data
#[tauri::command]
pub fn list_furniture_types(game_path: &str) -> Result<Vec<FurnitureInfo>, String> {
    let data_path = Path::new(game_path).join("data").join("json");

    if !data_path.exists() {
        return Err(format!("data/json directory not found at {:?}", data_path));
    }

    let mut furniture = Vec::new();

    // Walk through all JSON files looking for furniture definitions
    for entry in WalkDir::new(&data_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
    {
        if let Ok(content) = fs::read_to_string(entry.path()) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                extract_furniture_from_json(&json, &mut furniture);
            }
        }
    }

    // Sort by ID
    furniture.sort_by(|a, b| a.id.cmp(&b.id));
    furniture.dedup_by(|a, b| a.id == b.id);

    Ok(furniture)
}

fn extract_terrain_from_json(json: &Value, terrains: &mut Vec<TerrainInfo>) {
    match json {
        Value::Array(arr) => {
            for item in arr {
                extract_terrain_from_json(item, terrains);
            }
        }
        Value::Object(obj) => {
            if obj.get("type").and_then(|v| v.as_str()) == Some("terrain") {
                if let Some(id) = obj.get("id").and_then(|v| v.as_str()) {
                    let name = extract_name(obj.get("name")).unwrap_or_else(|| id.to_string());
                    let symbol = obj
                        .get("symbol")
                        .and_then(|v| v.as_str())
                        .unwrap_or(".")
                        .to_string();
                    let color = obj
                        .get("color")
                        .and_then(|v| v.as_str())
                        .unwrap_or("white")
                        .to_string();

                    terrains.push(TerrainInfo {
                        id: id.to_string(),
                        name,
                        symbol,
                        color,
                    });
                }
            }
        }
        _ => {}
    }
}

fn extract_furniture_from_json(json: &Value, furniture: &mut Vec<FurnitureInfo>) {
    match json {
        Value::Array(arr) => {
            for item in arr {
                extract_furniture_from_json(item, furniture);
            }
        }
        Value::Object(obj) => {
            if obj.get("type").and_then(|v| v.as_str()) == Some("furniture") {
                if let Some(id) = obj.get("id").and_then(|v| v.as_str()) {
                    let name = extract_name(obj.get("name")).unwrap_or_else(|| id.to_string());
                    let symbol = obj
                        .get("symbol")
                        .and_then(|v| v.as_str())
                        .unwrap_or("#")
                        .to_string();
                    let color = obj
                        .get("color")
                        .and_then(|v| v.as_str())
                        .unwrap_or("white")
                        .to_string();

                    furniture.push(FurnitureInfo {
                        id: id.to_string(),
                        name,
                        symbol,
                        color,
                    });
                }
            }
        }
        _ => {}
    }
}

fn extract_name(name_value: Option<&Value>) -> Option<String> {
    match name_value {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Object(obj)) => obj.get("str").and_then(|v| v.as_str()).map(|s| s.to_string()),
        _ => None,
    }
}
