import { useState, useMemo } from "react";
import type { ResolvedSymbol, TerrainInfo, FurnitureInfo } from "../../types";

interface MapPaletteProps {
  palette: ResolvedSymbol[];
  terrainTypes: TerrainInfo[];
  furnitureTypes: FurnitureInfo[];
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

export function MapPalette({
  palette,
  terrainTypes,
  furnitureTypes,
  selectedSymbol,
  onSelectSymbol,
  onUpdateSymbol,
  onAddSymbol,
}: MapPaletteProps) {
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [newSymbolInput, setNewSymbolInput] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  return (
    <div className="w-[480px] border-l border-zinc-700 flex flex-col bg-zinc-800">
      <div className="px-3 py-2 text-sm font-medium text-zinc-300 border-b border-zinc-700">
        Palette
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-800">
            <tr className="text-zinc-400 border-b border-zinc-700">
              <th className="px-2 py-1 text-left w-10">Sym</th>
              <th className="px-2 py-1 text-left">Terrain</th>
              <th className="px-2 py-1 text-left">Furniture</th>
              <th className="px-2 py-1 text-left w-28">Source</th>
            </tr>
          </thead>
          <tbody>
            {palette.map((item) => (
              <PaletteRow
                key={item.symbol}
                item={item}
                isSelected={selectedSymbol === item.symbol}
                isEditing={editingSymbol === item.symbol}
                terrainTypes={terrainTypes}
                furnitureTypes={furnitureTypes}
                onSelect={() => onSelectSymbol(item.symbol)}
                onStartEdit={() => setEditingSymbol(item.symbol)}
                onEndEdit={() => setEditingSymbol(null)}
                onUpdate={(newSymbol, terrain, furniture) => {
                  onUpdateSymbol(item.symbol, newSymbol, terrain, furniture);
                  setEditingSymbol(null);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new symbol */}
      <div className="border-t border-zinc-700 p-2">
        {showAddRow ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value.slice(0, 1))}
              placeholder="Sym"
              className="w-10 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-center text-sm"
              maxLength={1}
              autoFocus
            />
            <button
              onClick={() => {
                if (newSymbolInput) {
                  onAddSymbol(newSymbolInput, null, null);
                  setNewSymbolInput("");
                  setShowAddRow(false);
                }
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded"
            >
              Add
            </button>
            <button
              onClick={() => {
                setNewSymbolInput("");
                setShowAddRow(false);
              }}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddRow(true)}
            className="w-full px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded"
          >
            + Add Symbol
          </button>
        )}
      </div>
    </div>
  );
}

interface PaletteRowProps {
  item: ResolvedSymbol;
  isSelected: boolean;
  isEditing: boolean;
  terrainTypes: TerrainInfo[];
  furnitureTypes: FurnitureInfo[];
  onSelect: () => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onUpdate: (symbol: string, terrain: string | null, furniture: string | null) => void;
}

function PaletteRow({
  item,
  isSelected,
  isEditing,
  terrainTypes,
  furnitureTypes,
  onSelect,
  onStartEdit,
  onEndEdit,
  onUpdate,
}: PaletteRowProps) {
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

  const sourceLabel = item.source.type === "inline"
    ? "inline"
    : item.source.id?.slice(0, 8) ?? "ext";

  const sourceBadgeClass = item.source.type === "inline"
    ? "bg-zinc-600"
    : "bg-blue-600";

  if (isEditing) {
    return (
      <tr className="bg-zinc-700">
        <td className="px-2 py-1">
          <input
            type="text"
            value={editSymbol}
            onChange={(e) => setEditSymbol(e.target.value.slice(0, 1))}
            className="w-8 px-1 py-0.5 bg-zinc-900 border border-zinc-500 rounded text-center text-sm"
            maxLength={1}
          />
        </td>
        <td className="px-2 py-1 relative">
          <input
            type="text"
            value={terrainFilter || editTerrain}
            onChange={(e) => {
              setTerrainFilter(e.target.value);
              setShowTerrainDropdown(true);
            }}
            onFocus={() => setShowTerrainDropdown(true)}
            placeholder="t_..."
            className="w-full px-1 py-0.5 bg-zinc-900 border border-zinc-500 rounded text-sm"
          />
          {showTerrainDropdown && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-auto bg-zinc-900 border border-zinc-600 rounded shadow-lg">
              <div
                className="px-2 py-1 text-zinc-400 hover:bg-zinc-700 cursor-pointer text-xs"
                onClick={() => {
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
                  className="px-2 py-1 hover:bg-zinc-700 cursor-pointer text-xs"
                  onClick={() => {
                    setEditTerrain(t.id);
                    setTerrainFilter("");
                    setShowTerrainDropdown(false);
                  }}
                >
                  <span className="text-zinc-300">{t.id}</span>
                  <span className="text-zinc-500 ml-2">{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </td>
        <td className="px-2 py-1 relative">
          <input
            type="text"
            value={furnitureFilter || editFurniture}
            onChange={(e) => {
              setFurnitureFilter(e.target.value);
              setShowFurnitureDropdown(true);
            }}
            onFocus={() => setShowFurnitureDropdown(true)}
            placeholder="f_..."
            className="w-full px-1 py-0.5 bg-zinc-900 border border-zinc-500 rounded text-sm"
          />
          {showFurnitureDropdown && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-auto bg-zinc-900 border border-zinc-600 rounded shadow-lg">
              <div
                className="px-2 py-1 text-zinc-400 hover:bg-zinc-700 cursor-pointer text-xs"
                onClick={() => {
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
                  className="px-2 py-1 hover:bg-zinc-700 cursor-pointer text-xs"
                  onClick={() => {
                    setEditFurniture(f.id);
                    setFurnitureFilter("");
                    setShowFurnitureDropdown(false);
                  }}
                >
                  <span className="text-zinc-300">{f.id}</span>
                  <span className="text-zinc-500 ml-2">{f.name}</span>
                </div>
              ))}
            </div>
          )}
        </td>
        <td className="px-2 py-1">
          <div className="flex gap-1">
            <button
              onClick={() => onUpdate(
                editSymbol,
                editTerrain || null,
                editFurniture || null
              )}
              className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
            >
              ✓
            </button>
            <button
              onClick={onEndEdit}
              className="px-1.5 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-white text-xs rounded"
            >
              ✕
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`cursor-pointer hover:bg-zinc-700 ${
        isSelected ? "bg-blue-900/50" : ""
      }`}
      onClick={onSelect}
      onDoubleClick={onStartEdit}
    >
      <td className="px-2 py-1 font-mono text-center text-zinc-100">
        {item.symbol}
      </td>
      <td className="px-2 py-1 text-zinc-300 truncate" title={item.terrain ?? undefined}>
        {item.terrain ?? <span className="text-zinc-500">-</span>}
      </td>
      <td className="px-2 py-1 text-zinc-300 truncate" title={item.furniture ?? undefined}>
        {item.furniture ?? <span className="text-zinc-500">-</span>}
      </td>
      <td className="px-2 py-1">
        <span className={`px-1.5 py-0.5 text-xs rounded ${sourceBadgeClass}`}>
          {sourceLabel}
        </span>
      </td>
    </tr>
  );
}
