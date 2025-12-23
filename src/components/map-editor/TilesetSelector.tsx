import { useState, useEffect } from "react";
import type { TilesetInfo } from "../../types";
import { listTilesets } from "../../services/tileset";

interface TilesetSelectorProps {
  gamePath: string | null;
  selectedTileset: string | null;  // null = ASCII mode
  onSelectTileset: (tileset: string | null) => void;
}

export function TilesetSelector({
  gamePath,
  selectedTileset,
  onSelectTileset,
}: TilesetSelectorProps) {
  const [tilesets, setTilesets] = useState<TilesetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gamePath) {
      setTilesets([]);
      return;
    }

    setLoading(true);
    setError(null);

    listTilesets(gamePath)
      .then(setTilesets)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [gamePath]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-zinc-400">Tileset:</label>
      <select
        value={selectedTileset ?? ""}
        onChange={(e) => onSelectTileset(e.target.value || null)}
        disabled={!gamePath || loading}
        className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 disabled:opacity-50"
      >
        <option value="">ASCII</option>
        {tilesets.map((ts) => (
          <option key={ts.name} value={ts.name}>
            {ts.name}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs text-zinc-500">Loading...</span>}
      {error && <span className="text-xs text-red-400" title={error}>Error</span>}
    </div>
  );
}
