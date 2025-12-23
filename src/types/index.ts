// Types matching Rust structs

// Workspace types
export type PackId = string; // UUID
export type EntityKey = string; // Format: "{type}:{id}"

export interface PackMetadata {
  modId: string | null;
  modType: string | null;
  dependencies: string[];
  description: string | null;
  version: string | null;
  luaApiVersion: string | null;
  authors: string[];
  category: string | null;
}

export interface PackInfo {
  id: PackId;
  name: string;
  path: string;
  readOnly: boolean;
  entityCount: number;
  hasDirtyFiles: boolean;
  metadata?: PackMetadata;
}

export interface AvailableModInfo {
  path: string;
  metadata: PackMetadata;
}

export interface WorkspaceState {
  packs: PackInfo[];
  loadOrder: PackId[];
}

export interface EntitySummary {
  key: EntityKey;
  id: string;
  displayName: string | null;
  sourceFile: string;
  dirty: boolean;
}

export interface EntityTree {
  byType: Record<string, EntitySummary[]>;
}

export interface LoadStats {
  filesScanned: number;
  entitiesLoaded: number;
  errors: string[];
}

export interface PackLoadResult {
  packId: PackId;
  name: string;
  entityTree: EntityTree;
  loadStats: LoadStats;
}

// Entity types
export interface EntityMeta {
  entityType: string;
  id: string;
  displayName: string | null;
  copyFrom: string | null;
  references: EntityRef[];
}

export interface EntityRef {
  fieldPath: string;
  targetId: string;
  expectedType: string | null;
}

export interface EntityData {
  key: EntityKey;
  meta: EntityMeta;
  jsonText: string;
  sourceFile: string;
  readOnly: boolean;
  dirty: boolean;
}

export interface UpdateResult {
  validation: ValidationResult;
  accepted: boolean;
  newKey: string | null;
  meta: EntityMeta | null;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path: string | null;
  line: number | null;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string | null;
}

// Search types
export interface SearchResult {
  packId: PackId;
  packName: string;
  entityKey: EntityKey;
  entityId: string;
  entityType: string;
  displayName: string | null;
}

// Save types
export interface SaveResult {
  filesWritten: string[];
  entitiesSaved: number;
}

// UI state types
export interface Selection {
  packId: PackId | null;
  entityKey: EntityKey | null;
}

// Tileset types
export interface TilesetInfo {
  name: string;
  path: string;
}

export interface SpriteSheet {
  file: string;
  spriteWidth: number;
  spriteHeight: number;
  spriteOffsetX: number;
  spriteOffsetY: number;
}

export interface TileMapping {
  id: string;
  fg: number | null;
  bg: number | null;
  file: string;
}

export interface TilesetConfig {
  name: string;
  tileWidth: number;
  tileHeight: number;
  spriteSheets: SpriteSheet[];
  mappings: Record<string, TileMapping>;
}

// Terrain/Furniture types
export interface TerrainInfo {
  id: string;
  name: string;
  symbol: string;
  color: string;
}

export interface FurnitureInfo {
  id: string;
  name: string;
  symbol: string;
  color: string;
}

// Palette types
export interface SymbolMapping {
  symbol: string;
  terrain: string | null;
  furniture: string | null;
}

export interface PaletteData {
  id: string;
  mappings: SymbolMapping[];
  includes: string[];
}

export type PaletteSourceType = "external" | "inline";

export interface PaletteSource {
  type: PaletteSourceType;
  id?: string;
}

export interface ResolvedSymbol {
  symbol: string;
  terrain: string | null;
  furniture: string | null;
  source: PaletteSource;
}

// Map editor types
export type MapTool = "hand" | "paint" | "line" | "box" | "fill" | "eyedropper";

export interface MapEditorState {
  grid: string[][];
  palette: ResolvedSymbol[];
  selectedSymbol: string | null;
  tool: MapTool;
  boxFilled: boolean; // true = filled box, false = outline only
  isDirty: boolean;
}
