import { useState, useMemo, useRef, useEffect } from "react";
import type { ResolvedSymbol, TerrainInfo, FurnitureInfo } from "../../types";
import { LoadedTileset, renderTile, getColor } from "../../services/tileset";
import { usePanelResize } from "../../hooks/useColumnResize";
import { ResizableTable, ColumnDef } from "../common/ResizableTable";

interface MapPaletteProps {
  palette: ResolvedSymbol[];
  terrainTypes: TerrainInfo[];
  furnitureTypes: FurnitureInfo[];
  terrainLookup: Map<string, TerrainInfo>;
  tileset: LoadedTileset | null;
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  onUpdateSymbol: (
    oldSymbol: string,
    newSymbol: string,
    terrain: string | null,
    furniture: string | null
  ) => void;
  onAddSymbol: (symbol: string, terrain: string | null, furniture: string | null) => void;
}

const TILE_SIZE = 24;

export function MapPalette({
  palette,
  terrainTypes,
  furnitureTypes,
  terrainLookup,
  tileset,
  selectedSymbol,
  onSelectSymbol,
  onUpdateSymbol,
  onAddSymbol,
}: MapPaletteProps) {
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [newSymbolInput, setNewSymbolInput] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  const { height: panelHeight, handleResizeStart: handleHeightResizeStart } = usePanelResize(192);

  const columns: ColumnDef<ResolvedSymbol>[] = useMemo(() => [
    {
      key: "tile",
      label: "Tile",
      width: 32,
      minWidth: 28,
      render: (item) => (
        <TilePreview
          terrainId={item.terrain}
          furnitureId={item.furniture}
          tileset={tileset}
          terrainLookup={terrainLookup}
          symbol={item.symbol}
        />
      ),
    },
    {
      key: "sym",
      label: "Sym",
      width: 32,
      minWidth: 28,
      render: (item) => (
        <span className="font-mono text-center text-zinc-100">{item.symbol}</span>
      ),
    },
    {
      key: "terrain",
      label: "Terrain",
      width: 180,
      minWidth: 60,
      render: (item) => (
        <span className="text-zinc-300 truncate block" title={item.terrain ?? undefined}>
          {item.terrain ?? <span className="text-zinc-500">-</span>}
        </span>
      ),
    },
    {
      key: "furniture",
      label: "Furniture",
      width: 180,
      minWidth: 60,
      render: (item) => (
        <span className="text-zinc-300 truncate block" title={item.furniture ?? undefined}>
          {item.furniture ?? <span className="text-zinc-500">-</span>}
        </span>
      ),
    },
    {
      key: "source",
      label: "Source",
      width: 60,
      minWidth: 50,
      render: (item) => {
        const sourceLabel = item.source.type === "inline"
          ? "inline"
          : item.source.id?.slice(0, 8) ?? "ext";
        const sourceBadgeClass = item.source.type === "inline"
          ? "bg-zinc-600"
          : "bg-blue-600";
        return (
          <span className={`px-1 py-0.5 text-xs rounded ${sourceBadgeClass}`}>
            {sourceLabel}
          </span>
        );
      },
    },
  ], [tileset, terrainLookup]);

  // Filter out currently editing item from table data
  const tableData = useMemo(() =>
    palette.filter(item => item.symbol !== editingSymbol),
    [palette, editingSymbol]
  );

  const editingItem = editingSymbol
    ? palette.find(item => item.symbol === editingSymbol)
    : null;

  return (
    <div className="border-t border-zinc-700 flex flex-col bg-zinc-800 relative" style={{ height: panelHeight }}>
      {/* Height resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 z-10"
        onMouseDown={handleHeightResizeStart}
      />
      <div className="px-3 py-1 text-xs font-medium text-zinc-400 border-b border-zinc-700 flex items-center justify-between">
        <span>Palette ({palette.length} symbols)</span>
        {!showAddRow && (
          <button
            onClick={() => setShowAddRow(true)}
            className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded"
          >
            + Add
          </button>
        )}
      </div>

      {/* Add row */}
      {showAddRow && (
        <div className="flex items-center gap-2 px-2 py-1 bg-zinc-700/50 border-b border-zinc-600">
          <div className="w-6 h-6 bg-zinc-900 rounded" />
          <input
            type="text"
            value={newSymbolInput}
            onChange={(e) => setNewSymbolInput(e.target.value.slice(0, 1))}
            placeholder="?"
            className="w-6 px-1 py-0.5 bg-zinc-900 border border-zinc-600 rounded text-center text-xs"
            maxLength={1}
            autoFocus
          />
          <span className="text-zinc-500 text-xs italic flex-1">Set terrain/furniture after adding</span>
          <button
            onClick={() => {
              if (newSymbolInput) {
                onAddSymbol(newSymbolInput, null, null);
                setNewSymbolInput("");
                setShowAddRow(false);
              }
            }}
            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
          >
            Add
          </button>
          <button
            onClick={() => {
              setNewSymbolInput("");
              setShowAddRow(false);
            }}
            className="px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-white text-xs rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editing row */}
      {editingItem && (
        <EditingRow
          item={editingItem}
          terrainTypes={terrainTypes}
          furnitureTypes={furnitureTypes}
          terrainLookup={terrainLookup}
          tileset={tileset}
          onSave={(newSymbol, terrain, furniture) => {
            onUpdateSymbol(editingItem.symbol, newSymbol, terrain, furniture);
            setEditingSymbol(null);
          }}
          onCancel={() => setEditingSymbol(null)}
        />
      )}

      {/* Table */}
      <ResizableTable
        columns={columns}
        data={tableData}
        getRowKey={(item) => item.symbol}
        selectedKey={selectedSymbol}
        onSelectRow={(item) => onSelectSymbol(item.symbol)}
        onDoubleClickRow={(item) => setEditingSymbol(item.symbol)}
        rowHeight={28}
      />
    </div>
  );
}

interface EditingRowProps {
  item: ResolvedSymbol;
  terrainTypes: TerrainInfo[];
  furnitureTypes: FurnitureInfo[];
  terrainLookup: Map<string, TerrainInfo>;
  tileset: LoadedTileset | null;
  onSave: (symbol: string, terrain: string | null, furniture: string | null) => void;
  onCancel: () => void;
}

function EditingRow({
  item,
  terrainTypes,
  furnitureTypes,
  terrainLookup,
  tileset,
  onSave,
  onCancel,
}: EditingRowProps) {
  const [editSymbol, setEditSymbol] = useState(item.symbol);
  const [editTerrain, setEditTerrain] = useState(item.terrain ?? "");
  const [editFurniture, setEditFurniture] = useState(item.furniture ?? "");
  const [terrainFilter, setTerrainFilter] = useState("");
  const [furnitureFilter, setFurnitureFilter] = useState("");
  const [showTerrainDropdown, setShowTerrainDropdown] = useState(false);
  const [showFurnitureDropdown, setShowFurnitureDropdown] = useState(false);

  const filteredTerrain = useMemo(() => {
    if (!terrainFilter) return terrainTypes.slice(0, 50);
    const lower = terrainFilter.toLowerCase();
    return terrainTypes
      .filter((t) => t.id.toLowerCase().includes(lower) || t.name.toLowerCase().includes(lower))
      .slice(0, 50);
  }, [terrainTypes, terrainFilter]);

  const filteredFurniture = useMemo(() => {
    if (!furnitureFilter) return furnitureTypes.slice(0, 50);
    const lower = furnitureFilter.toLowerCase();
    return furnitureTypes
      .filter((f) => f.id.toLowerCase().includes(lower) || f.name.toLowerCase().includes(lower))
      .slice(0, 50);
  }, [furnitureTypes, furnitureFilter]);

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-zinc-700 border-b border-zinc-600">
      <TilePreview
        terrainId={editTerrain || null}
        furnitureId={editFurniture || null}
        tileset={tileset}
        terrainLookup={terrainLookup}
        symbol={editSymbol}
      />
      <input
        type="text"
        value={editSymbol}
        onChange={(e) => setEditSymbol(e.target.value.slice(0, 1))}
        className="w-6 px-1 py-0.5 bg-zinc-900 border border-zinc-500 rounded text-center text-xs"
        maxLength={1}
      />
      <div className="relative flex-1">
        <input
          type="text"
          value={terrainFilter || editTerrain}
          onChange={(e) => {
            setTerrainFilter(e.target.value);
            setShowTerrainDropdown(true);
          }}
          onFocus={() => setShowTerrainDropdown(true)}
          onBlur={() => setTimeout(() => setShowTerrainDropdown(false), 150)}
          placeholder="t_..."
          className="w-full px-1 py-0.5 bg-zinc-900 border border-zinc-500 rounded text-xs"
        />
        {showTerrainDropdown && (
          <div className="absolute z-20 left-0 right-0 bottom-full mb-1 max-h-32 overflow-auto bg-zinc-900 border border-zinc-600 rounded shadow-lg">
            <div
              className="px-2 py-0.5 text-zinc-400 hover:bg-zinc-700 cursor-pointer text-xs"
              onMouseDown={() => {
                setEditTerrain("");
                setTerrainFilter("");
                setShowTerrainDropdown(false);
              }}
            >
              (none)
            </div>
            {filteredTerrain.map((t) => (
              <div
                key={t.id}
                className="px-2 py-0.5 hover:bg-zinc-700 cursor-pointer text-xs"
                onMouseDown={() => {
                  setEditTerrain(t.id);
                  setTerrainFilter("");
                  setShowTerrainDropdown(false);
                }}
              >
                <span className="text-zinc-300">{t.id}</span>
                <span className="text-zinc-500 ml-1">{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="relative flex-1">
        <input
          type="text"
          value={furnitureFilter || editFurniture}
          onChange={(e) => {
            setFurnitureFilter(e.target.value);
            setShowFurnitureDropdown(true);
          }}
          onFocus={() => setShowFurnitureDropdown(true)}
          onBlur={() => setTimeout(() => setShowFurnitureDropdown(false), 150)}
          placeholder="f_..."
          className="w-full px-1 py-0.5 bg-zinc-900 border border-zinc-500 rounded text-xs"
        />
        {showFurnitureDropdown && (
          <div className="absolute z-20 left-0 right-0 bottom-full mb-1 max-h-32 overflow-auto bg-zinc-900 border border-zinc-600 rounded shadow-lg">
            <div
              className="px-2 py-0.5 text-zinc-400 hover:bg-zinc-700 cursor-pointer text-xs"
              onMouseDown={() => {
                setEditFurniture("");
                setFurnitureFilter("");
                setShowFurnitureDropdown(false);
              }}
            >
              (none)
            </div>
            {filteredFurniture.map((f) => (
              <div
                key={f.id}
                className="px-2 py-0.5 hover:bg-zinc-700 cursor-pointer text-xs"
                onMouseDown={() => {
                  setEditFurniture(f.id);
                  setFurnitureFilter("");
                  setShowFurnitureDropdown(false);
                }}
              >
                <span className="text-zinc-300">{f.id}</span>
                <span className="text-zinc-500 ml-1">{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onSave(editSymbol, editTerrain || null, editFurniture || null)}
        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-white text-xs rounded"
      >
        Cancel
      </button>
    </div>
  );
}

interface TilePreviewProps {
  terrainId: string | null;
  furnitureId: string | null;
  tileset: LoadedTileset | null;
  terrainLookup: Map<string, TerrainInfo>;
  symbol: string;
}

function TilePreview({ terrainId, furnitureId, tileset, terrainLookup, symbol }: TilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    if (tileset) {
      renderTile(ctx, tileset, terrainId, furnitureId, 0, 0, TILE_SIZE);
    } else {
      const terrain = terrainId ? terrainLookup.get(terrainId) : null;
      const color = terrain?.color ? getColor(terrain.color) : "#ffffff";

      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      ctx.fillStyle = color;
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, TILE_SIZE / 2, TILE_SIZE / 2);
    }
  }, [terrainId, furnitureId, tileset, terrainLookup, symbol]);

  return (
    <canvas
      ref={canvasRef}
      width={TILE_SIZE}
      height={TILE_SIZE}
      className="rounded flex-shrink-0"
      style={{ width: TILE_SIZE, height: TILE_SIZE }}
    />
  );
}
