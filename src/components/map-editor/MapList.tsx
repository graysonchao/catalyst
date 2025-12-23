import { useState, useMemo } from "react";
import type { MapgenInfo } from "../../services/mapgen";

interface MapListProps {
  maps: MapgenInfo[];
  onSelectMap: (map: MapgenInfo) => void;
  selectedMapKey: string | null;
}

type SortKey = "omTerrain" | "packName" | "size" | "weight" | "sourceFile";
type SortDir = "asc" | "desc";

export function MapList({ maps, onSelectMap, selectedMapKey }: MapListProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("omTerrain");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filteredMaps = useMemo(() => {
    const query = search.toLowerCase();
    return maps.filter(
      (m) =>
        m.omTerrain.toLowerCase().includes(query) ||
        m.packName.toLowerCase().includes(query) ||
        m.sourceFile.toLowerCase().includes(query)
    );
  }, [maps, search]);

  const sortedMaps = useMemo(() => {
    return [...filteredMaps].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "omTerrain":
          cmp = a.omTerrain.localeCompare(b.omTerrain);
          break;
        case "packName":
          cmp = a.packName.localeCompare(b.packName);
          break;
        case "size":
          cmp = a.gridWidth * a.gridHeight - b.gridWidth * b.gridHeight;
          break;
        case "weight":
          cmp = a.weight - b.weight;
          break;
        case "sourceFile":
          cmp = a.sourceFile.localeCompare(b.sourceFile);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredMaps, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ column, label }: { column: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(column)}
      className="px-3 py-2 text-left text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200 select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === column && (
          <span className="text-blue-400">{sortDir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-2 border-b border-zinc-700">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search maps..."
          className="w-full px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-800 border-b border-zinc-700">
            <tr>
              <SortHeader column="omTerrain" label="OM Terrain" />
              <SortHeader column="packName" label="Pack" />
              <SortHeader column="size" label="Size" />
              <SortHeader column="weight" label="Weight" />
              <SortHeader column="sourceFile" label="File" />
            </tr>
          </thead>
          <tbody>
            {sortedMaps.map((map) => (
              <tr
                key={map.entityKey}
                onClick={() => onSelectMap(map)}
                className={`cursor-pointer border-b border-zinc-700/50 ${
                  selectedMapKey === map.entityKey
                    ? "bg-blue-900/30"
                    : "hover:bg-zinc-700/30"
                }`}
              >
                <td className="px-3 py-1.5 text-zinc-100 font-mono">
                  {map.omTerrain}
                  {map.isMultiTile && (
                    <span className="ml-1 text-[10px] px-1 bg-purple-900/50 text-purple-300 rounded">
                      {map.gridWidth}x{map.gridHeight}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-zinc-400">{map.packName}</td>
                <td className="px-3 py-1.5 text-zinc-400">{map.size}</td>
                <td className="px-3 py-1.5 text-zinc-400">{map.weight}</td>
                <td className="px-3 py-1.5 text-zinc-500 text-xs truncate max-w-[200px]">
                  {map.sourceFile}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedMaps.length === 0 && (
          <div className="p-8 text-center text-zinc-500">
            {maps.length === 0 ? "No maps loaded" : "No maps match your search"}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 text-xs text-zinc-500 border-t border-zinc-700 bg-zinc-800">
        {sortedMaps.length} of {maps.length} maps
      </div>
    </div>
  );
}
