use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

/// A single entity from a BN JSON file
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entity {
    /// Parsed metadata for indexing/display
    pub meta: EntityMeta,
    /// The original JSON, preserved exactly
    pub json: Value,
    /// Source file (relative to pack root)
    pub source_file: PathBuf,
    /// Position in the source file's array (for saving back)
    pub array_index: usize,
    /// Whether this entity has unsaved modifications
    pub dirty: bool,
}

/// Parsed metadata extracted from entity JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityMeta {
    /// Entity type (e.g., "MONSTER", "GENERIC", "recipe")
    pub entity_type: String,
    /// Entity ID (e.g., "mon_zombie", "sword_iron")
    pub id: String,
    /// Display name, extracted from name field
    pub display_name: Option<String>,
    /// If this entity copies from another
    pub copy_from: Option<String>,
    /// IDs this entity references (for cross-reference navigation)
    pub references: Vec<EntityRef>,
}

/// A reference from one entity to another
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityRef {
    /// The field path where this reference occurs (e.g., "result", "components[0][0]")
    pub field_path: String,
    /// The referenced entity ID
    pub target_id: String,
    /// Expected type of the target (if known)
    pub expected_type: Option<String>,
}

/// Full entity data for editing
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityData {
    pub key: String,
    pub meta: EntityMeta,
    /// Pretty-printed JSON for editor
    pub json_text: String,
    pub source_file: PathBuf,
    pub read_only: bool,
    pub dirty: bool,
}

/// Result of updating an entity
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub validation: super::ValidationResult,
    pub accepted: bool,
    /// New entity key if type/id changed
    pub new_key: Option<String>,
    /// Updated metadata
    pub meta: Option<EntityMeta>,
}

/// Result of creating a new entity
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResult {
    pub validation: super::ValidationResult,
    pub accepted: bool,
    pub entity_key: Option<String>,
}

impl Entity {
    /// Create an entity from parsed JSON
    pub fn from_json(json: Value, source_file: PathBuf, array_index: usize) -> Option<Self> {
        let meta = EntityMeta::from_json(&json)?;
        Some(Self {
            meta,
            json,
            source_file,
            array_index,
            dirty: false,
        })
    }

    /// Get the entity key (type:id)
    pub fn key(&self) -> String {
        format!("{}:{}", self.meta.entity_type, self.meta.id)
    }

    /// Convert to EntityData for frontend
    pub fn to_data(&self, read_only: bool) -> EntityData {
        EntityData {
            key: self.key(),
            meta: self.meta.clone(),
            json_text: serde_json::to_string_pretty(&self.json).unwrap_or_default(),
            source_file: self.source_file.clone(),
            read_only,
            dirty: self.dirty,
        }
    }
}

impl EntityMeta {
    /// Extract metadata from JSON value
    pub fn from_json(json: &Value) -> Option<Self> {
        let entity_type = json.get("type")?.as_str()?.to_string();

        // Get ID - some entity types use different fields
        let id = Self::extract_id(json, &entity_type)?;

        let display_name = Self::extract_display_name(json);
        let copy_from = json
            .get("copy-from")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let references = Self::extract_references(json);

        Some(Self {
            entity_type,
            id,
            display_name,
            copy_from,
            references,
        })
    }

    /// Extract the entity ID from JSON
    fn extract_id(json: &Value, entity_type: &str) -> Option<String> {
        // Check if this is an abstract entity (no id required)
        if json
            .get("abstract")
            .and_then(|v| v.as_str())
            .is_some()
        {
            // Abstract entities use "abstract" field as their id
            return json
                .get("abstract")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }

        // Recipe entities use "result" as their identifier if no "id"
        if entity_type == "recipe" || entity_type == "uncraft" {
            if let Some(id) = json.get("id").and_then(|v| v.as_str()) {
                return Some(id.to_string());
            }
            if let Some(result) = json.get("result").and_then(|v| v.as_str()) {
                // For recipes, combine with id_suffix if present
                let suffix = json
                    .get("id_suffix")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("_{}", s))
                    .unwrap_or_default();
                return Some(format!("{}{}", result, suffix));
            }
        }

        // Mapgen entities use om_terrain as their identifier
        if entity_type == "mapgen" {
            if let Some(om_terrain) = json.get("om_terrain") {
                // om_terrain can be string, array of strings, or 2D array
                if let Some(s) = om_terrain.as_str() {
                    return Some(s.to_string());
                }
                if let Some(arr) = om_terrain.as_array() {
                    if let Some(first) = arr.first() {
                        // Could be string or another array (2D)
                        if let Some(s) = first.as_str() {
                            return Some(s.to_string());
                        }
                        if let Some(inner_arr) = first.as_array() {
                            if let Some(inner_first) = inner_arr.first() {
                                if let Some(s) = inner_first.as_str() {
                                    return Some(s.to_string());
                                }
                            }
                        }
                    }
                }
            }
            // Nested mapgen uses nested_mapgen_id
            if let Some(nested_id) = json.get("nested_mapgen_id").and_then(|v| v.as_str()) {
                return Some(nested_id.to_string());
            }
        }

        // Palette entities use their id field
        if entity_type == "palette" {
            return json.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
        }

        // Standard id field
        json.get("id").and_then(|v| v.as_str()).map(|s| s.to_string())
    }

    /// Extract display name from JSON
    fn extract_display_name(json: &Value) -> Option<String> {
        let name = json.get("name")?;

        // Name can be a string or an object with "str" field
        if let Some(s) = name.as_str() {
            return Some(s.to_string());
        }

        if let Some(obj) = name.as_object() {
            if let Some(s) = obj.get("str").and_then(|v| v.as_str()) {
                return Some(s.to_string());
            }
        }

        None
    }

    /// Extract references to other entities (for future cross-reference navigation)
    fn extract_references(json: &Value) -> Vec<EntityRef> {
        let mut refs = Vec::new();

        // copy-from is a key reference
        if let Some(copy_from) = json.get("copy-from").and_then(|v| v.as_str()) {
            refs.push(EntityRef {
                field_path: "copy-from".to_string(),
                target_id: copy_from.to_string(),
                expected_type: json.get("type").and_then(|v| v.as_str()).map(|s| s.to_string()),
            });
        }

        // result field in recipes
        if let Some(result) = json.get("result").and_then(|v| v.as_str()) {
            refs.push(EntityRef {
                field_path: "result".to_string(),
                target_id: result.to_string(),
                expected_type: None, // Could be any item type
            });
        }

        // TODO: Parse components, tools, etc. for more complete reference extraction

        refs
    }
}
