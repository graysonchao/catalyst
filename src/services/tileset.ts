import { invoke } from "@tauri-apps/api/core";
import type { TilesetInfo, TilesetConfig } from "../types";

export async function listTilesets(gamePath: string): Promise<TilesetInfo[]> {
  return invoke("list_tilesets", { gamePath });
}

export async function loadTilesetConfig(
  gamePath: string,
  tilesetName: string
): Promise<TilesetConfig> {
  return invoke("load_tileset_config", { gamePath, tilesetName });
}

export async function loadTilesetImage(
  gamePath: string,
  tilesetName: string,
  imageFile: string
): Promise<string> {
  return invoke("load_tileset_image", { gamePath, tilesetName, imageFile });
}

export interface LoadedTileset {
  config: TilesetConfig;
  images: Map<string, HTMLImageElement>;
}

/**
 * Load a complete tileset with all its sprite sheets
 */
export async function loadTileset(
  gamePath: string,
  tilesetName: string
): Promise<LoadedTileset> {
  const config = await loadTilesetConfig(gamePath, tilesetName);
  const images = new Map<string, HTMLImageElement>();

  // Load all sprite sheet images
  for (const sheet of config.spriteSheets) {
    const base64 = await loadTilesetImage(gamePath, tilesetName, sheet.file);
    const img = await loadImageFromBase64(base64);
    images.set(sheet.file, img);
  }

  return { config, images };
}

function loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64}`;
  });
}

/**
 * Calculate sprite position in the sprite sheet
 * Column count is determined by image width / sprite width
 */
export function getSpritePosition(
  spriteIndex: number,
  spriteWidth: number,
  spriteHeight: number,
  imageWidth: number
): { x: number; y: number } {
  const columns = Math.floor(imageWidth / spriteWidth);
  const col = spriteIndex % columns;
  const row = Math.floor(spriteIndex / columns);
  return {
    x: col * spriteWidth,
    y: row * spriteHeight,
  };
}

/**
 * Render a tile to a canvas context
 */
export function renderTile(
  ctx: CanvasRenderingContext2D,
  tileset: LoadedTileset,
  terrainId: string | null,
  furnitureId: string | null,
  destX: number,
  destY: number,
  cellSize: number
): void {
  const { config, images } = tileset;

  // Render terrain (background layer)
  if (terrainId) {
    const mapping = config.mappings[terrainId];
    if (mapping && mapping.fg !== null) {
      const sheet = config.spriteSheets.find((s) => s.file === mapping.file);
      const img = images.get(mapping.file);

      if (sheet && img) {
        const pos = getSpritePosition(mapping.fg, sheet.spriteWidth, sheet.spriteHeight, img.width);
        ctx.drawImage(
          img,
          pos.x,
          pos.y,
          sheet.spriteWidth,
          sheet.spriteHeight,
          destX,
          destY,
          cellSize,
          cellSize
        );
      }
    }
  }

  // Render furniture (foreground layer)
  if (furnitureId) {
    const mapping = config.mappings[furnitureId];
    if (mapping && mapping.fg !== null) {
      const sheet = config.spriteSheets.find((s) => s.file === mapping.file);
      const img = images.get(mapping.file);

      if (sheet && img) {
        const pos = getSpritePosition(mapping.fg, sheet.spriteWidth, sheet.spriteHeight, img.width);
        ctx.drawImage(
          img,
          pos.x,
          pos.y,
          sheet.spriteWidth,
          sheet.spriteHeight,
          destX,
          destY,
          cellSize,
          cellSize
        );
      }
    }
  }
}

// Color map for ASCII rendering (matching Cataclysm colors)
const COLOR_MAP: Record<string, string> = {
  black: "#000000",
  red: "#ff0000",
  green: "#00ff00",
  brown: "#a52a2a",
  blue: "#0000ff",
  magenta: "#ff00ff",
  cyan: "#00ffff",
  light_gray: "#d3d3d3",
  dark_gray: "#a9a9a9",
  light_red: "#ff6b6b",
  light_green: "#90ee90",
  yellow: "#ffff00",
  light_blue: "#add8e6",
  pink: "#ffc0cb",
  light_cyan: "#e0ffff",
  white: "#ffffff",
};

export function getColor(colorName: string): string {
  return COLOR_MAP[colorName] || COLOR_MAP.white;
}
