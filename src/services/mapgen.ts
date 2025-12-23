export interface MapgenInfo {
  packId: string;
  packName: string;
  entityKey: string;
  omTerrain: string;
  size: string;  // "24x24", "48x24", "72x72", etc.
  weight: number;
  sourceFile: string;
  isMultiTile: boolean;
  gridWidth: number;  // in OMTs (1, 2, 3, etc.)
  gridHeight: number;
}

export interface MapgenJson {
  type: "mapgen";
  method: "json";
  om_terrain?: string | string[] | string[][];
  weight?: number;
  object?: {
    fill_ter?: string;
    rows?: string[];
    terrain?: Record<string, unknown>;
    furniture?: Record<string, unknown>;
    items?: Record<string, unknown>;
    traps?: Record<string, unknown>;
    palettes?: string[];
  };
}

/**
 * Extract mapgen info from parsed JSON
 */
export function parseMapgenInfo(
  json: MapgenJson,
  packId: string,
  packName: string,
  entityKey: string,
  sourceFile: string
): MapgenInfo | null {
  if (json.type !== "mapgen" || json.method !== "json") {
    return null;
  }

  const omTerrain = json.om_terrain;
  if (!omTerrain) return null;

  // Determine grid size from om_terrain shape
  let gridWidth = 1;
  let gridHeight = 1;
  let omTerrainDisplay: string;

  if (typeof omTerrain === "string") {
    omTerrainDisplay = omTerrain;
  } else if (Array.isArray(omTerrain)) {
    if (omTerrain.length === 0) return null;

    // Check if it's a 2D array (multi-tile)
    if (Array.isArray(omTerrain[0])) {
      // 2D array: rows of OMTs
      gridHeight = omTerrain.length;
      gridWidth = (omTerrain[0] as string[]).length;
      omTerrainDisplay = (omTerrain[0] as string[])[0] || "unknown";
    } else {
      // 1D array: linear arrangement or single
      gridWidth = omTerrain.length;
      omTerrainDisplay = omTerrain[0] as string;
    }
  } else {
    return null;
  }

  const tileWidth = gridWidth * 24;
  const tileHeight = gridHeight * 24;
  const size = `${tileWidth}x${tileHeight}`;

  return {
    packId,
    packName,
    entityKey,
    omTerrain: omTerrainDisplay,
    size,
    weight: json.weight ?? 100,
    sourceFile,
    isMultiTile: gridWidth > 1 || gridHeight > 1,
    gridWidth,
    gridHeight,
  };
}

/**
 * Parse mapgen rows into a 2D grid of symbols
 */
export function parseMapgenRows(json: MapgenJson): string[][] | null {
  const obj = json.object;
  if (!obj) return null;

  const rows = obj.rows;
  if (!rows || !Array.isArray(rows)) return null;

  return rows.map(row => row.split(""));
}

/**
 * Get palette mappings from mapgen object
 */
export interface PaletteMapping {
  symbol: string;
  terrain?: string | string[];
  furniture?: string | string[];
  items?: unknown;
  traps?: unknown;
}

export function getPaletteMappings(json: MapgenJson): PaletteMapping[] {
  const obj = json.object;
  if (!obj) return [];

  const terrain = obj.terrain;
  const furniture = obj.furniture;
  const items = obj.items;
  const traps = obj.traps;

  // Collect all unique symbols
  const symbols = new Set<string>();
  if (terrain) Object.keys(terrain).forEach(s => symbols.add(s));
  if (furniture) Object.keys(furniture).forEach(s => symbols.add(s));
  if (items) Object.keys(items).forEach(s => symbols.add(s));
  if (traps) Object.keys(traps).forEach(s => symbols.add(s));

  return Array.from(symbols).sort().map(symbol => ({
    symbol,
    terrain: terrain?.[symbol] as string | string[] | undefined,
    furniture: furniture?.[symbol] as string | string[] | undefined,
    items: items?.[symbol],
    traps: traps?.[symbol],
  }));
}

import type { ResolvedSymbol, PaletteData, PaletteSource } from "../types";

/**
 * Extract first ID from a terrain/furniture value
 * Can be: "t_floor", ["t_floor", "t_grass"], [["t_floor", 2], "t_grass"]
 */
function extractFirstId(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string") {
      return first;
    }
    if (Array.isArray(first) && first.length > 0 && typeof first[0] === "string") {
      return first[0];
    }
  }
  return null;
}

/**
 * Resolve all symbol mappings for a mapgen, merging external palettes with inline definitions.
 * Priority (highest to lowest):
 * 1. Inline terrain/furniture in mapgen object
 * 2. Last palette in palettes array
 * 3. Earlier palettes
 * 4. fill_ter as fallback
 */
export function resolveSymbolMappings(
  mapgenJson: MapgenJson,
  externalPalettes: Map<string, PaletteData>
): ResolvedSymbol[] {
  const obj = mapgenJson.object;
  if (!obj) return [];

  const resolved = new Map<string, ResolvedSymbol>();

  // 1. Start with fill_ter as fallback for empty space
  const fillTer = obj.fill_ter;
  if (fillTer) {
    // Fill terrain applies to space and period by convention
    for (const symbol of [" ", "."]) {
      resolved.set(symbol, {
        symbol,
        terrain: fillTer,
        furniture: null,
        source: { type: "inline" },
      });
    }
  }

  // 2. Apply external palettes in order (first to last)
  const paletteIds = obj.palettes ?? [];
  for (const paletteId of paletteIds) {
    const palette = externalPalettes.get(paletteId);
    if (palette) {
      applyPalette(resolved, palette, { type: "external", id: paletteId });
    }
  }

  // 3. Apply inline terrain/furniture (highest priority)
  const inlineTerrain = obj.terrain as Record<string, unknown> | undefined;
  const inlineFurniture = obj.furniture as Record<string, unknown> | undefined;

  if (inlineTerrain) {
    for (const [symbol, value] of Object.entries(inlineTerrain)) {
      const terrainId = extractFirstId(value);
      const existing = resolved.get(symbol);
      if (existing) {
        existing.terrain = terrainId;
        existing.source = { type: "inline" };
      } else {
        resolved.set(symbol, {
          symbol,
          terrain: terrainId,
          furniture: null,
          source: { type: "inline" },
        });
      }
    }
  }

  if (inlineFurniture) {
    for (const [symbol, value] of Object.entries(inlineFurniture)) {
      const furnitureId = extractFirstId(value);
      const existing = resolved.get(symbol);
      if (existing) {
        existing.furniture = furnitureId;
        // Only change source if we're adding furniture to an external palette's terrain
        if (existing.source.type === "external") {
          existing.source = { type: "inline" };
        }
      } else {
        resolved.set(symbol, {
          symbol,
          terrain: null,
          furniture: furnitureId,
          source: { type: "inline" },
        });
      }
    }
  }

  // 4. Collect all symbols used in rows to include unmapped symbols
  const rows = obj.rows ?? [];
  for (const row of rows) {
    for (const char of row) {
      if (!resolved.has(char)) {
        resolved.set(char, {
          symbol: char,
          terrain: fillTer || null,
          furniture: null,
          source: { type: "inline" },
        });
      }
    }
  }

  // Sort by symbol and return
  return Array.from(resolved.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function applyPalette(
  resolved: Map<string, ResolvedSymbol>,
  palette: PaletteData,
  source: PaletteSource
): void {
  for (const mapping of palette.mappings) {
    const existing = resolved.get(mapping.symbol);
    if (existing) {
      // Override with palette values
      if (mapping.terrain) existing.terrain = mapping.terrain;
      if (mapping.furniture) existing.furniture = mapping.furniture;
      existing.source = source;
    } else {
      resolved.set(mapping.symbol, {
        symbol: mapping.symbol,
        terrain: mapping.terrain,
        furniture: mapping.furniture,
        source,
      });
    }
  }
}

/**
 * Update a row in the grid with a new symbol at the given position
 */
export function updateGridCell(
  grid: string[][],
  row: number,
  col: number,
  symbol: string
): string[][] {
  const newGrid = grid.map(r => [...r]);
  if (row >= 0 && row < newGrid.length && col >= 0 && col < newGrid[row].length) {
    newGrid[row][col] = symbol;
  }
  return newGrid;
}

/**
 * Convert grid back to mapgen rows format
 */
export function gridToRows(grid: string[][]): string[] {
  return grid.map(row => row.join(""));
}
