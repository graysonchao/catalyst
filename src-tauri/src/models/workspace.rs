use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

use super::entity::Entity;

/// Unique identifier for a content pack within this session
pub type PackId = Uuid;

/// Unique identifier for an entity within a pack
/// Format: "{type}:{id}" e.g., "MONSTER:mon_zombie"
pub type EntityKey = String;

/// The entire loaded workspace state
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    /// All loaded content packs, keyed by PackId
    pub packs: HashMap<PackId, ContentPack>,
    /// Load order (first pack is lowest priority for copy-from resolution)
    pub load_order: Vec<PackId>,
}

/// A single content pack (base game data or mod)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentPack {
    pub id: PackId,
    pub name: String,
    pub path: PathBuf,
    pub read_only: bool,
    /// All entities in this pack, keyed by EntityKey
    pub entities: HashMap<EntityKey, Entity>,
    /// Tracks which files have unsaved changes
    pub dirty_files: Vec<PathBuf>,
    /// Metadata about the pack (from modinfo.json if present)
    pub metadata: Option<PackMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PackMetadata {
    /// Mod ID from modinfo.json
    pub mod_id: Option<String>,
    /// Mod type (e.g., "CORE" for base game)
    pub mod_type: Option<String>,
    /// Dependencies on other mods
    pub dependencies: Vec<String>,
    /// Description from modinfo.json
    pub description: Option<String>,
    /// Version string
    pub version: Option<String>,
    /// Lua API version
    pub lua_api_version: Option<String>,
    /// Authors list
    pub authors: Vec<String>,
    /// Category (e.g., "content", "total_conversion", etc.)
    pub category: Option<String>,
}

/// Summary of an entity for tree view (lightweight, no full JSON)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntitySummary {
    pub key: EntityKey,
    pub entity_type: String,
    pub id: String,
    pub display_name: Option<String>,
    pub source_file: PathBuf,
    pub array_index: usize,
    pub dirty: bool,
}

/// Tree structure for sidebar navigation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityTree {
    /// Entities grouped by type
    pub by_type: HashMap<String, Vec<EntitySummary>>,
    /// Entities grouped by source file (for tree view)
    pub by_file: HashMap<PathBuf, Vec<EntitySummary>>,
}

/// Result of loading a pack
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackLoadResult {
    pub pack_id: PackId,
    pub name: String,
    pub entity_tree: EntityTree,
    pub load_stats: LoadStats,
}

/// Statistics about a pack load operation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadStats {
    pub files_scanned: usize,
    pub entities_loaded: usize,
    pub errors: Vec<String>,
}

/// Lightweight workspace state for UI refresh
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub packs: Vec<PackInfo>,
    pub load_order: Vec<PackId>,
}

/// Basic info about a pack (for listing)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackInfo {
    pub id: PackId,
    pub name: String,
    pub path: PathBuf,
    pub read_only: bool,
    pub entity_count: usize,
    pub has_dirty_files: bool,
    pub metadata: Option<PackMetadata>,
}

impl ContentPack {
    pub fn new(id: PackId, name: String, path: PathBuf, read_only: bool) -> Self {
        Self {
            id,
            name,
            path,
            read_only,
            entities: HashMap::new(),
            dirty_files: Vec::new(),
            metadata: None,
        }
    }

    pub fn to_entity_tree(&self) -> EntityTree {
        let mut by_type: HashMap<String, Vec<EntitySummary>> = HashMap::new();
        let mut by_file: HashMap<PathBuf, Vec<EntitySummary>> = HashMap::new();

        for (key, entity) in &self.entities {
            let summary = EntitySummary {
                key: key.clone(),
                entity_type: entity.meta.entity_type.clone(),
                id: entity.meta.id.clone(),
                display_name: entity.meta.display_name.clone(),
                source_file: entity.source_file.clone(),
                array_index: entity.array_index,
                dirty: entity.dirty,
            };

            // Group by type
            by_type
                .entry(entity.meta.entity_type.clone())
                .or_default()
                .push(summary.clone());

            // Group by file
            by_file
                .entry(entity.source_file.clone())
                .or_default()
                .push(summary);
        }

        // Sort entities within each type by display name or id
        for entities in by_type.values_mut() {
            entities.sort_by(|a, b| {
                let name_a = a.display_name.as_ref().unwrap_or(&a.id);
                let name_b = b.display_name.as_ref().unwrap_or(&b.id);
                name_a.cmp(name_b)
            });
        }

        // Sort entities within each file by array_index to preserve original order
        for entities in by_file.values_mut() {
            entities.sort_by_key(|e| e.array_index);
        }

        EntityTree { by_type, by_file }
    }

    pub fn to_info(&self) -> PackInfo {
        PackInfo {
            id: self.id,
            name: self.name.clone(),
            path: self.path.clone(),
            read_only: self.read_only,
            entity_count: self.entities.len(),
            has_dirty_files: !self.dirty_files.is_empty(),
            metadata: self.metadata.clone(),
        }
    }
}

impl Workspace {
    pub fn to_state(&self) -> WorkspaceState {
        WorkspaceState {
            packs: self
                .load_order
                .iter()
                .filter_map(|id| self.packs.get(id).map(|p| p.to_info()))
                .collect(),
            load_order: self.load_order.clone(),
        }
    }
}
