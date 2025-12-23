import { useState, useMemo, useEffect, useCallback } from "react";
import { MapList } from "./MapList";
import { MapGrid } from "./MapGrid";
import { MapPalette } from "./MapPalette";
import { MapToolbar } from "./MapToolbar";
import { TilesetSelector } from "./TilesetSelector";
import { useMapEditor } from "../../hooks/useMapEditor";
import { useTileset } from "../../hooks/useTileset";
import { getEntity, updateEntity } from "../../services/api";
import { getCachedTerrainTypes, getCachedFurnitureTypes } from "../../services/terrain";
import type { MapgenInfo } from "../../services/mapgen";
import type { LoadedPack } from "../../hooks/useWorkspace";
import type { TerrainInfo, FurnitureInfo } from "../../types";

interface MapEditorProps {
  packs: Map<string, LoadedPack>;
  loadOrder: string[];
  enabledPacks: Set<string>;
  gamePath: string | null;
}

export function MapEditor({ packs, loadOrder, enabledPacks, gamePath }: MapEditorProps) {
  const [selectedMap, setSelectedMap] = useState<MapgenInfo | null>(null);
  const [selectedTilesetName, setSelectedTilesetName] = useState<string | null>(null);
  const [terrainTypes, setTerrainTypes] = useState<TerrainInfo[]>([]);
  const [furnitureTypes, setFurnitureTypes] = useState<FurnitureInfo[]>([]);

  const mapEditor = useMapEditor();
  const tilesetHook = useTileset();

  // Extract all mapgen entities from enabled packs only
  const maps = useMemo(() => {
    const result: MapgenInfo[] = [];

    for (const packId of loadOrder) {
      // Skip disabled packs
      if (!enabledPacks.has(packId)) continue;

      const pack = packs.get(packId);
      if (!pack) continue;

      const mapgenEntities = pack.entityTree.byType["mapgen"] || [];

      for (const entity of mapgenEntities) {
        result.push({
          packId,
          packName: pack.name,
          entityKey: entity.key,
          omTerrain: entity.id || entity.key,
          size: "24x24",
          weight: 100,
          sourceFile: entity.sourceFile,
          isMultiTile: false,
          gridWidth: 1,
          gridHeight: 1,
        });
      }
    }

    return result;
  }, [packs, loadOrder, enabledPacks]);

  // Load terrain and furniture types when game path changes
  useEffect(() => {
    if (!gamePath) return;

    getCachedTerrainTypes(gamePath)
      .then(setTerrainTypes)
      .catch((e) => console.error("Failed to load terrain types:", e));

    getCachedFurnitureTypes(gamePath)
      .then(setFurnitureTypes)
      .catch((e) => console.error("Failed to load furniture types:", e));
  }, [gamePath]);

  // Load tileset when selection changes
  useEffect(() => {
    if (!gamePath || !selectedTilesetName) {
      tilesetHook.clear();
      return;
    }

    tilesetHook.load(gamePath, selectedTilesetName);
  }, [gamePath, selectedTilesetName]);

  // Load map entity when selection changes
  const handleSelectMap = useCallback(
    async (map: MapgenInfo) => {
      setSelectedMap(map);
      mapEditor.reset();

      if (!gamePath) return;

      try {
        const entity = await getEntity(map.packId, map.entityKey);
        await mapEditor.loadEntity(entity, gamePath);
      } catch (e) {
        console.error("Failed to load map entity:", e);
      }
    },
    [gamePath, mapEditor]
  );

  // Save changes
  const handleSave = useCallback(async () => {
    if (!selectedMap || !mapEditor.isDirty) return;

    const modifiedJson = mapEditor.getModifiedJson();
    if (!modifiedJson) return;

    try {
      const result = await updateEntity(
        selectedMap.packId,
        selectedMap.entityKey,
        modifiedJson
      );
      if (result.accepted) {
        // Reload to get fresh state
        const entity = await getEntity(selectedMap.packId, selectedMap.entityKey);
        if (gamePath) {
          await mapEditor.loadEntity(entity, gamePath);
        }
      }
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [selectedMap, mapEditor, gamePath]);

  // Create terrain lookup map
  const terrainLookup = useMemo(() => {
    const map = new Map<string, TerrainInfo>();
    for (const t of terrainTypes) {
      map.set(t.id, t);
    }
    return map;
  }, [terrainTypes]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          mapEditor.redo();
        } else {
          e.preventDefault();
          mapEditor.undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mapEditor]);

  if (!gamePath) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <p className="text-lg mb-2">Game Directory Not Set</p>
          <p className="text-sm mb-4">
            Please select your Cataclysm-BN directory in Settings
          </p>
          <p className="text-xs text-zinc-600">
            This can be a repository checkout, installed game, or .app bundle
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full">
      {/* Left: Map list */}
      <div className="w-80 border-r border-zinc-700 flex flex-col">
        <div className="px-3 py-1 text-xs font-medium text-zinc-400 border-b border-zinc-700 bg-zinc-800 flex items-center justify-between">
          <span>Maps</span>
          <TilesetSelector
            gamePath={gamePath}
            selectedTileset={selectedTilesetName}
            onSelectTileset={setSelectedTilesetName}
          />
        </div>
        <MapList
          maps={maps}
          onSelectMap={handleSelectMap}
          selectedMapKey={selectedMap?.entityKey ?? null}
        />
      </div>

      {/* Right: Editor area with bottom palette */}
      <div className="flex-1 flex flex-col">
        {selectedMap && mapEditor.grid.length > 0 ? (
          <>
            {/* Header with map info */}
            <div className="px-4 py-1 border-b border-zinc-700 bg-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-zinc-100">
                  {selectedMap.omTerrain}
                </span>
                <span className="text-xs text-zinc-500">{selectedMap.sourceFile}</span>
                {mapEditor.isDirty && (
                  <span className="text-xs text-yellow-400">Modified</span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={!mapEditor.isDirty}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded"
              >
                Save
              </button>
            </div>

            {/* Toolbar */}
            <MapToolbar
              tool={mapEditor.tool}
              boxFilled={mapEditor.boxFilled}
              onToolChange={mapEditor.setTool}
              onToggleBoxFilled={mapEditor.toggleBoxFilled}
              selectedSymbol={mapEditor.selectedSymbol}
              palette={mapEditor.palette}
              canUndo={mapEditor.canUndo}
              canRedo={mapEditor.canRedo}
              onUndo={mapEditor.undo}
              onRedo={mapEditor.redo}
            />

            {/* Grid */}
            <MapGrid
              grid={mapEditor.grid}
              palette={mapEditor.palette}
              terrainLookup={terrainLookup}
              tileset={tilesetHook.tileset}
              selectedSymbol={mapEditor.selectedSymbol}
              tool={mapEditor.tool}
              boxFilled={mapEditor.boxFilled}
              onCellChange={mapEditor.updateCell}
              onCellsChange={mapEditor.updateCells}
              onCommitPaintStroke={mapEditor.commitPaintStroke}
              onToolChange={mapEditor.setTool}
              onSelectSymbol={mapEditor.selectSymbol}
              onGetSymbolAt={mapEditor.getSymbolAt}
            />

            {/* Bottom: Palette panel */}
            <MapPalette
              palette={mapEditor.palette}
              terrainTypes={terrainTypes}
              furnitureTypes={furnitureTypes}
              terrainLookup={terrainLookup}
              tileset={tilesetHook.tileset}
              selectedSymbol={mapEditor.selectedSymbol}
              onSelectSymbol={mapEditor.selectSymbol}
              onUpdateSymbol={mapEditor.updateSymbolMapping}
              onAddSymbol={mapEditor.addSymbol}
            />
          </>
        ) : mapEditor.loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Loading map...
          </div>
        ) : mapEditor.error ? (
          <div className="flex-1 flex items-center justify-center text-red-400">
            Error: {mapEditor.error}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <p>Select a map from the list to edit</p>
              <p className="text-sm mt-2 text-zinc-600">{maps.length} maps available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
