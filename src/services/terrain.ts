import { invoke } from "@tauri-apps/api/core";
import type { TerrainInfo, FurnitureInfo, PaletteData } from "../types";

export async function listTerrainTypes(gamePath: string): Promise<TerrainInfo[]> {
  return invoke("list_terrain_types", { gamePath });
}

export async function listFurnitureTypes(gamePath: string): Promise<FurnitureInfo[]> {
  return invoke("list_furniture_types", { gamePath });
}

export async function loadPalette(
  gamePath: string,
  paletteId: string
): Promise<PaletteData> {
  return invoke("load_palette", { gamePath, paletteId });
}

// Cached terrain/furniture lists
let cachedTerrain: TerrainInfo[] | null = null;
let cachedFurniture: FurnitureInfo[] | null = null;
let cacheGamePath: string | null = null;

export async function getCachedTerrainTypes(gamePath: string): Promise<TerrainInfo[]> {
  if (cachedTerrain && cacheGamePath === gamePath) {
    return cachedTerrain;
  }
  cachedTerrain = await listTerrainTypes(gamePath);
  cacheGamePath = gamePath;
  return cachedTerrain;
}

export async function getCachedFurnitureTypes(gamePath: string): Promise<FurnitureInfo[]> {
  if (cachedFurniture && cacheGamePath === gamePath) {
    return cachedFurniture;
  }
  cachedFurniture = await listFurnitureTypes(gamePath);
  cacheGamePath = gamePath;
  return cachedFurniture;
}

export function clearTerrainCache(): void {
  cachedTerrain = null;
  cachedFurniture = null;
  cacheGamePath = null;
}
