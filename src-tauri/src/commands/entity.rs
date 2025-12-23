use tauri::State;

use crate::models::{EntityData, EntityKey, EntityMeta, PackId, UpdateResult};
use crate::services::validator;
use crate::AppState;

/// Get full entity data for editing
#[tauri::command]
pub fn get_entity(
    state: State<'_, AppState>,
    pack_id: PackId,
    entity_key: EntityKey,
) -> Result<EntityData, String> {
    let workspace = state.workspace.lock().map_err(|e| e.to_string())?;

    let pack = workspace
        .packs
        .get(&pack_id)
        .ok_or_else(|| format!("Pack {} not found", pack_id))?;

    let entity = pack
        .entities
        .get(&entity_key)
        .ok_or_else(|| format!("Entity {} not found", entity_key))?;

    Ok(entity.to_data(pack.read_only))
}

/// Update an entity's JSON
#[tauri::command]
pub fn update_entity(
    state: State<'_, AppState>,
    pack_id: PackId,
    entity_key: EntityKey,
    new_json_text: String,
) -> Result<UpdateResult, String> {
    // First validate the new JSON
    let validation = validator::validate_json_text(&new_json_text);

    if !validation.valid {
        return Ok(UpdateResult {
            validation,
            accepted: false,
            new_key: None,
            meta: None,
        });
    }

    // Parse the JSON
    let new_json: serde_json::Value =
        serde_json::from_str(&new_json_text).map_err(|e| e.to_string())?;

    // Extract new metadata
    let new_meta = EntityMeta::from_json(&new_json)
        .ok_or_else(|| "Could not extract entity metadata from JSON".to_string())?;

    let new_key = format!("{}:{}", new_meta.entity_type, new_meta.id);

    let mut workspace = state.workspace.lock().map_err(|e| e.to_string())?;

    let pack = workspace
        .packs
        .get_mut(&pack_id)
        .ok_or_else(|| format!("Pack {} not found", pack_id))?;

    // Check if pack is read-only
    if pack.read_only {
        return Err("Cannot modify entities in a read-only pack".to_string());
    }

    // Get the existing entity
    let entity = pack
        .entities
        .get_mut(&entity_key)
        .ok_or_else(|| format!("Entity {} not found", entity_key))?;

    // Update the entity
    let source_file = entity.source_file.clone();
    entity.json = new_json;
    entity.meta = new_meta.clone();
    entity.dirty = true;

    // Track dirty file
    if !pack.dirty_files.contains(&source_file) {
        pack.dirty_files.push(source_file);
    }

    // Handle key change
    let key_changed = new_key != entity_key;
    if key_changed {
        // Need to re-insert with new key
        let entity = pack.entities.remove(&entity_key).unwrap();
        pack.entities.insert(new_key.clone(), entity);
    }

    Ok(UpdateResult {
        validation,
        accepted: true,
        new_key: if key_changed { Some(new_key) } else { None },
        meta: Some(new_meta),
    })
}

/// Search entities across all packs
#[tauri::command]
pub fn search_entities(
    state: State<'_, AppState>,
    query: String,
    entity_types: Option<Vec<String>>,
    pack_ids: Option<Vec<PackId>>,
) -> Result<Vec<SearchResult>, String> {
    let workspace = state.workspace.lock().map_err(|e| e.to_string())?;

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for (pack_id, pack) in &workspace.packs {
        // Filter by pack_ids if specified
        if let Some(ref ids) = pack_ids {
            if !ids.contains(pack_id) {
                continue;
            }
        }

        for (entity_key, entity) in &pack.entities {
            // Filter by entity type if specified
            if let Some(ref types) = entity_types {
                if !types.contains(&entity.meta.entity_type) {
                    continue;
                }
            }

            // Check if entity matches query
            let matches = entity.meta.id.to_lowercase().contains(&query_lower)
                || entity
                    .meta
                    .display_name
                    .as_ref()
                    .map(|n| n.to_lowercase().contains(&query_lower))
                    .unwrap_or(false);

            if matches {
                results.push(SearchResult {
                    pack_id: *pack_id,
                    pack_name: pack.name.clone(),
                    entity_key: entity_key.clone(),
                    entity_id: entity.meta.id.clone(),
                    entity_type: entity.meta.entity_type.clone(),
                    display_name: entity.meta.display_name.clone(),
                });
            }
        }
    }

    // Sort by relevance (exact matches first, then alphabetically)
    results.sort_by(|a, b| {
        let a_exact = a.entity_id.to_lowercase() == query_lower
            || a.display_name
                .as_ref()
                .map(|n| n.to_lowercase() == query_lower)
                .unwrap_or(false);
        let b_exact = b.entity_id.to_lowercase() == query_lower
            || b.display_name
                .as_ref()
                .map(|n| n.to_lowercase() == query_lower)
                .unwrap_or(false);

        match (a_exact, b_exact) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let a_name = a.display_name.as_ref().unwrap_or(&a.entity_id);
                let b_name = b.display_name.as_ref().unwrap_or(&b.entity_id);
                a_name.cmp(b_name)
            }
        }
    });

    // Limit results
    results.truncate(100);

    Ok(results)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub pack_id: PackId,
    pub pack_name: String,
    pub entity_key: EntityKey,
    pub entity_id: String,
    pub entity_type: String,
    pub display_name: Option<String>,
}
