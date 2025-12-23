# Catalyst Implementation Plan

A Tauri 2 desktop app for editing Cataclysm: Bright Nights mod JSON files.

## Summary

**MVP Features:**
1. Multi-mod workspace - load multiple content packs (base game + mods), each read-only or editable
2. Entity tree view - browse all entities by type across loaded packs
3. Raw JSON editing with validation
4. Save changes back to original files

**Architecture:** Rust holds authoritative data, React handles UI only. Entities are loaded into Rust, frontend requests data on demand via Tauri commands.

---

## Data Model

### Key Structures (Rust)

```
Workspace
├── packs: HashMap<PackId, ContentPack>
└── load_order: Vec<PackId>

ContentPack
├── id: PackId (UUID)
├── name, path, read_only
├── entities: HashMap<EntityKey, Entity>  // key = "{type}:{id}"
└── dirty_files: Vec<PathBuf>

Entity
├── meta: EntityMeta { entity_type, id, display_name, copy_from, references }
├── json: serde_json::Value  // original JSON preserved
├── source_file: PathBuf
├── array_index: usize  // position in file's array
└── dirty: bool
```

### Tauri Commands

| Command | Purpose |
|---------|---------|
| `load_content_pack(path, read_only)` | Load a mod/data folder |
| `close_pack(pack_id, force)` | Unload a pack |
| `get_workspace_state()` | Get current workspace for UI refresh |
| `get_entity(pack_id, entity_key)` | Get full JSON for editing |
| `update_entity(pack_id, entity_key, new_json)` | Update entity, returns validation result |
| `create_entity(pack_id, target_file, json)` | Create new entity |
| `delete_entity(pack_id, entity_key)` | Delete entity |
| `save_pack(pack_id)` | Write all dirty entities to disk |
| `search_entities(query)` | Search across packs |

---

## File Structure

### Rust Backend
```
src-tauri/src/
├── lib.rs                 # Tauri setup, AppState, command registration
├── main.rs                # Entry point (existing)
├── commands/
│   ├── mod.rs
│   ├── workspace.rs       # load_content_pack, close_pack, get_workspace_state
│   ├── entity.rs          # get_entity, update_entity, create_entity, delete_entity
│   └── file.rs            # save_pack, save_file
├── models/
│   ├── mod.rs
│   ├── workspace.rs       # Workspace, ContentPack
│   ├── entity.rs          # Entity, EntityMeta, EntityRef
│   └── validation.rs      # ValidationResult, ValidationError
└── services/
    ├── mod.rs
    ├── loader.rs          # JSON file discovery and parsing
    └── validator.rs       # Entity validation logic
```

### React Frontend
```
src/
├── App.tsx                # Root with 3-panel layout
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── EditorPanel.tsx
│   ├── sidebar/
│   │   ├── PackList.tsx
│   │   ├── EntityTree.tsx
│   │   └── EntityItem.tsx
│   └── editor/
│       ├── EntityEditor.tsx
│       ├── JsonEditor.tsx      # Monaco wrapper
│       ├── EditorToolbar.tsx
│       └── ValidationDisplay.tsx
├── hooks/
│   ├── useWorkspace.ts
│   └── useEntity.ts
├── types/
│   └── index.ts           # TypeScript types matching Rust structs
└── services/
    └── api.ts             # Tauri invoke wrappers
```

---

## Dependencies to Add

### Cargo.toml
```toml
uuid = { version = "1", features = ["v4", "serde"] }
thiserror = "2"
walkdir = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

### package.json
```json
"@tauri-apps/plugin-dialog": "^2",
"@tauri-apps/plugin-fs": "^2",
"@monaco-editor/react": "^4.6.0",
"tailwindcss": "^4",
"@tailwindcss/vite": "^4"
```

### Tauri Capabilities
Add to `src-tauri/capabilities/default.json`:
- `dialog:default`
- `fs:default`, `fs:allow-read`, `fs:allow-write`

---

## Implementation Phases

### Phase 1: Core Data Layer
**Goal:** Load packs, parse entities, basic CRUD

Files to create/modify:
- `src-tauri/src/models/*.rs` - Data structures
- `src-tauri/src/services/loader.rs` - JSON file discovery & parsing
- `src-tauri/src/services/validator.rs` - Basic validation (valid JSON, has type/id)
- `src-tauri/src/commands/workspace.rs` - load_content_pack, get_workspace_state
- `src-tauri/src/commands/entity.rs` - get_entity, update_entity
- `src-tauri/src/lib.rs` - AppState, command registration
- `src-tauri/Cargo.toml` - Dependencies

### Phase 2: Basic UI
**Goal:** Working UI that can browse and display entities

Files to create/modify:
- `src/types/index.ts` - TypeScript types
- `src/services/api.ts` - Tauri command wrappers
- `src/hooks/useWorkspace.ts` - Workspace state hook
- `src/hooks/useEntity.ts` - Entity loading hook
- `src/components/layout/*.tsx` - App layout
- `src/components/sidebar/*.tsx` - Pack list & entity tree
- `src/components/editor/JsonEditor.tsx` - Monaco editor wrapper
- `src/App.tsx` - Replace template with real app
- `package.json` - Frontend deps

### Phase 3: Full CRUD & Persistence
**Goal:** Create, edit, delete entities; save to disk

Files to create/modify:
- `src-tauri/src/commands/entity.rs` - create_entity, delete_entity
- `src-tauri/src/commands/file.rs` - save_pack, save_file
- `src/components/editor/EditorToolbar.tsx` - Save button
- `src/components/dialogs/NewEntityDialog.tsx`
- Dirty state tracking throughout

### Phase 4: Polish
**Goal:** Search, better validation, UX improvements

- Search functionality (commands + UI)
- Type-specific validation rules
- Keyboard shortcuts
- Error handling & user feedback

---

## Validation Strategy

**Layered approach:**
1. **JSON syntax** - Is it valid JSON?
2. **Base structure** - Has `type` field? Has `id` field (with exceptions)?
3. **Type-specific** - Required fields per entity type (future)
4. **Cross-references** - Do referenced IDs exist? (future, informational)

Validation runs on every `update_entity` call. Invalid JSON blocks save; warnings don't.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data ownership | Rust only | Single source of truth, no sync |
| Entity key format | `{type}:{id}` | Same ID can exist across types |
| JSON storage | Raw `serde_json::Value` | Preserves formatting |
| Pack ID | UUID | Avoids path issues |
| Validation | Fail-soft on load | Don't block loading malformed content |
| JSON editor | Monaco | Syntax highlighting, error markers |

---

## Future Features (designed for, not implementing)

- **Cross-reference navigation**: Click ID → jump to definition
- **Visual editors**: Vehicle blueprint editor, mapgen preview
- **File watching**: Detect external changes
- **Bulk operations**: Find/replace across entities
