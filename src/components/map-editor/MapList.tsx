import { useState, useMemo } from "react";
import { ResizableTable, ColumnDef } from "../common/ResizableTable";
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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key as SortKey);
      setSortDir("asc");
    }
  };

  const columns: ColumnDef<MapgenInfo>[] = useMemo(() => [
    {
      key: "omTerrain",
      label: "OM Terrain",
      width: 180,
      minWidth: 80,
      sortable: true,
      render: (map) => (
        <span className="text-zinc-100 font-mono">
          {map.omTerrain}
          {map.isMultiTile && (
            <span className="ml-1 text-[10px] px-1 bg-purple-900/50 text-purple-300 rounded">
              {map.gridWidth}x{map.gridHeight}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "packName",
      label: "Pack",
      width: 100,
      minWidth: 50,
      sortable: true,
      render: (map) => <span className="text-zinc-400">{map.packName}</span>,
    },
    {
      key: "size",
      label: "Size",
      width: 50,
      minWidth: 40,
      sortable: true,
      render: (map) => <span className="text-zinc-400">{map.size}</span>,
    },
    {
      key: "weight",
      label: "Weight",
      width: 50,
      minWidth: 40,
      sortable: true,
      render: (map) => <span className="text-zinc-400">{map.weight}</span>,
    },
    {
      key: "sourceFile",
      label: "File",
      width: 150,
      minWidth: 60,
      sortable: true,
      render: (map) => (
        <span className="text-zinc-500 truncate block">{map.sourceFile}</span>
      ),
    },
  ], []);

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
      <ResizableTable
        columns={columns}
        data={sortedMaps}
        getRowKey={(map) => map.entityKey}
        selectedKey={selectedMapKey}
        onSelectRow={onSelectMap}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        rowHeight={18}
      />

      {sortedMaps.length === 0 && (
        <div className="p-8 text-center text-zinc-500">
          {maps.length === 0 ? "No maps loaded" : "No maps match your search"}
        </div>
      )}

      {/* Status bar */}
      <div className="px-3 py-1 text-xs text-zinc-500 border-t border-zinc-700 bg-zinc-800">
        {sortedMaps.length} of {maps.length} maps
      </div>
    </div>
  );
}
