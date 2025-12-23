use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::models::PackId;
use crate::AppState;

/// Fields that should appear first in JSON objects, in this order
const PRIORITY_FIELDS: &[&str] = &["type", "id", "name"];

/// Serialize JSON with priority fields hoisted to the top of each object
fn serialize_with_priority_fields(value: &serde_json::Value) -> String {
    let mut output = Vec::new();
    write_value(&mut output, value, 0);
    String::from_utf8(output).unwrap()
}

fn write_value(out: &mut Vec<u8>, value: &serde_json::Value, indent: usize) {
    match value {
        serde_json::Value::Null => out.extend_from_slice(b"null"),
        serde_json::Value::Bool(b) => {
            out.extend_from_slice(if *b { b"true" } else { b"false" });
        }
        serde_json::Value::Number(n) => {
            out.extend_from_slice(n.to_string().as_bytes());
        }
        serde_json::Value::String(s) => {
            out.extend_from_slice(serde_json::to_string(s).unwrap().as_bytes());
        }
        serde_json::Value::Array(arr) => {
            write_array(out, arr, indent);
        }
        serde_json::Value::Object(obj) => {
            write_object(out, obj, indent);
        }
    }
}

fn write_array(out: &mut Vec<u8>, arr: &[serde_json::Value], indent: usize) {
    if arr.is_empty() {
        out.extend_from_slice(b"[]");
        return;
    }

    out.extend_from_slice(b"[\n");
    for (i, item) in arr.iter().enumerate() {
        write_indent(out, indent + 1);
        write_value(out, item, indent + 1);
        if i < arr.len() - 1 {
            out.push(b',');
        }
        out.push(b'\n');
    }
    write_indent(out, indent);
    out.push(b']');
}

fn write_object(out: &mut Vec<u8>, obj: &serde_json::Map<String, serde_json::Value>, indent: usize) {
    if obj.is_empty() {
        out.extend_from_slice(b"{}");
        return;
    }

    // Collect keys, putting priority fields first
    let mut keys: Vec<&String> = Vec::with_capacity(obj.len());

    // Add priority fields first (in order) if they exist
    for pf in PRIORITY_FIELDS {
        if obj.contains_key(*pf) {
            keys.push(obj.get_key_value(*pf).unwrap().0);
        }
    }

    // Add remaining fields in their original order
    for key in obj.keys() {
        if !PRIORITY_FIELDS.contains(&key.as_str()) {
            keys.push(key);
        }
    }

    out.extend_from_slice(b"{\n");
    for (i, key) in keys.iter().enumerate() {
        write_indent(out, indent + 1);
        out.extend_from_slice(serde_json::to_string(key).unwrap().as_bytes());
        out.extend_from_slice(b": ");
        write_value(out, &obj[*key], indent + 1);
        if i < keys.len() - 1 {
            out.push(b',');
        }
        out.push(b'\n');
    }
    write_indent(out, indent);
    out.push(b'}');
}

fn write_indent(out: &mut Vec<u8>, level: usize) {
    for _ in 0..level {
        out.extend_from_slice(b"  ");
    }
}

/// Result of a save operation
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub files_written: Vec<String>,
    pub entities_saved: usize,
}

/// Save all dirty entities in a pack back to their source files
#[tauri::command]
pub async fn save_pack(state: State<'_, AppState>, pack_id: PackId) -> Result<SaveResult, String> {
    let mut workspace = state.workspace.lock().map_err(|e| e.to_string())?;

    let pack = workspace
        .packs
        .get_mut(&pack_id)
        .ok_or_else(|| format!("Pack {} not found", pack_id))?;

    if pack.read_only {
        return Err("Cannot save a read-only pack".to_string());
    }

    if pack.dirty_files.is_empty() {
        return Ok(SaveResult {
            files_written: Vec::new(),
            entities_saved: 0,
        });
    }

    // Group entities by source file
    let mut entities_by_file: HashMap<PathBuf, Vec<(usize, serde_json::Value)>> = HashMap::new();

    for entity in pack.entities.values() {
        if entity.dirty {
            entities_by_file
                .entry(entity.source_file.clone())
                .or_default()
                .push((entity.array_index, entity.json.clone()));
        }
    }

    let mut files_written = Vec::new();
    let mut entities_saved = 0;

    // For each dirty file, read it, update the entities, and write it back
    for (relative_path, dirty_entities) in &entities_by_file {
        let full_path = pack.path.join(relative_path);

        // Read the existing file
        let content = fs::read_to_string(&full_path).map_err(|e| {
            format!(
                "Failed to read {}: {}",
                relative_path.display(),
                e
            )
        })?;

        let mut json_array: Vec<serde_json::Value> =
            serde_json::from_str(&content).map_err(|e| {
                format!(
                    "Failed to parse {}: {}",
                    relative_path.display(),
                    e
                )
            })?;

        // Update the entities in the array
        for (array_index, new_json) in dirty_entities {
            if *array_index < json_array.len() {
                json_array[*array_index] = new_json.clone();
                entities_saved += 1;
            }
        }

        // Write back to file with pretty formatting, priority fields first
        let array_value = serde_json::Value::Array(json_array);
        let output = serialize_with_priority_fields(&array_value);

        fs::write(&full_path, output).map_err(|e| {
            format!(
                "Failed to write {}: {}",
                relative_path.display(),
                e
            )
        })?;

        files_written.push(relative_path.to_string_lossy().to_string());
    }

    // Clear dirty flags
    for entity in pack.entities.values_mut() {
        if entity.dirty {
            entity.dirty = false;
        }
    }
    pack.dirty_files.clear();

    Ok(SaveResult {
        files_written,
        entities_saved,
    })
}
