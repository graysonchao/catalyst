import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PackId, EntityKey } from "../../types";
import type { LoadedPack } from "../../hooks/useWorkspace";

interface EntityBrowserProps {
  packs: Map<PackId, LoadedPack>;
  loadOrder: PackId[];
  enabledPacks: Set<PackId>;
  onSelectEntity: (packId: PackId, entityKey: EntityKey) => void;
  onLoadPack?: () => void;
}

interface EntityRow {
  packId: PackId;
  packName: string;
  entityKey: EntityKey;
  type: string;
  id: string;
  displayName: string | null;
  sourceFile: string;
}

const columnHelper = createColumnHelper<EntityRow>();

const columns = [
  columnHelper.accessor("type", {
    header: "Type",
    cell: (info) => (
      <span className="px-1 py-0.5 bg-zinc-700 rounded text-xs">
        {info.getValue()}
      </span>
    ),
    size: 140,
  }),
  columnHelper.accessor("id", {
    header: "ID",
    cell: (info) => (
      <span className="font-mono text-zinc-200 text-xs truncate block">
        {info.getValue()}
      </span>
    ),
    size: 280,
  }),
  columnHelper.accessor("displayName", {
    header: "Name",
    cell: (info) => (
      <span className="text-zinc-400 text-xs truncate block">
        {info.getValue() ?? ""}
      </span>
    ),
    size: 200,
  }),
  columnHelper.accessor("packName", {
    header: "Pack",
    cell: (info) => <span className="text-zinc-400 text-xs">{info.getValue()}</span>,
    size: 120,
  }),
  columnHelper.accessor("sourceFile", {
    header: "Source",
    cell: (info) => (
      <span className="text-zinc-500 text-xs truncate block">{info.getValue()}</span>
    ),
    size: 180,
  }),
];

export function EntityBrowser({
  packs,
  loadOrder,
  enabledPacks,
  onSelectEntity,
  onLoadPack,
}: EntityBrowserProps) {
  // Filter state
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set());
  const [packFilter, setPackFilter] = useState<Set<PackId>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "type", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Virtualization ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Filter to only globally enabled packs
  const enabledLoadOrder = useMemo(() => {
    return loadOrder.filter((packId) => enabledPacks.has(packId));
  }, [loadOrder, enabledPacks]);

  // Flatten all entities into rows (only from enabled packs)
  const allEntities = useMemo((): EntityRow[] => {
    const rows: EntityRow[] = [];

    for (const packId of enabledLoadOrder) {
      const pack = packs.get(packId);
      if (!pack) continue;

      for (const [type, entities] of Object.entries(pack.entityTree.byType)) {
        for (const entity of entities) {
          rows.push({
            packId,
            packName: pack.name,
            entityKey: entity.key,
            type,
            id: entity.id,
            displayName: entity.displayName,
            sourceFile: entity.sourceFile,
          });
        }
      }
    }

    return rows;
  }, [packs, enabledLoadOrder]);

  // Get unique types
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const row of allEntities) {
      types.add(row.type);
    }
    return Array.from(types).sort();
  }, [allEntities]);

  // Track if we've initialized filters (to avoid fighting with user selections)
  const typesInitialized = useRef(false);
  const packsInitialized = useRef(false);

  // Initialize enabled filters when data loads (only once per data source)
  useEffect(() => {
    if (!typesInitialized.current && allTypes.length > 0) {
      setEnabledTypes(new Set(allTypes));
      typesInitialized.current = true;
    }
  }, [allTypes]);

  useEffect(() => {
    if (!packsInitialized.current && enabledLoadOrder.length > 0) {
      setPackFilter(new Set(enabledLoadOrder));
      packsInitialized.current = true;
    }
  }, [enabledLoadOrder]);

  // Pre-filter data based on type/pack toggles
  const filteredByToggles = useMemo(() => {
    let result = allEntities;

    // Filter by enabled types
    if (enabledTypes.size > 0 && enabledTypes.size < allTypes.length) {
      result = result.filter((e) => enabledTypes.has(e.type));
    }

    // Filter by pack filter (additional filtering within enabled packs)
    if (packFilter.size > 0 && packFilter.size < enabledLoadOrder.length) {
      result = result.filter((e) => packFilter.has(e.packId));
    }

    return result;
  }, [allEntities, enabledTypes, packFilter, allTypes.length, enabledLoadOrder.length]);

  // Global filter function for search
  const globalFilterFn = useCallback(
    (row: EntityRow, query: string): boolean => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        row.id.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q) ||
        row.displayName?.toLowerCase().includes(q) ||
        row.sourceFile.toLowerCase().includes(q)
      );
    },
    []
  );

  // Apply search filter
  const tableData = useMemo(() => {
    if (!searchQuery) return filteredByToggles;
    return filteredByToggles.filter((row) => globalFilterFn(row, searchQuery));
  }, [filteredByToggles, searchQuery, globalFilterFn]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 24, // Compact row height
    overscan: 20,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }
      if (e.key === "Escape" && isSearchFocused) {
        setIsSearchFocused(false);
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchFocused]);

  const toggleType = useCallback((type: string) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const togglePack = useCallback((packId: PackId) => {
    setPackFilter((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }, []);

  const selectAllTypes = useCallback(() => {
    setEnabledTypes(new Set(allTypes));
  }, [allTypes]);

  const selectNoTypes = useCallback(() => {
    setEnabledTypes(new Set());
  }, []);

  const selectAllPacks = useCallback(() => {
    setPackFilter(new Set(enabledLoadOrder));
  }, [enabledLoadOrder]);

  const selectNoPacks = useCallback(() => {
    setPackFilter(new Set());
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Filter Controls */}
      <div className="relative z-10 border-b border-zinc-700 bg-zinc-800 p-3 space-y-3 flex-shrink-0">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities... (Cmd+F)"
            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm focus:outline-none focus:border-blue-500"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          <span className="text-xs text-zinc-500">
            {rows.length.toLocaleString()} / {allEntities.length.toLocaleString()} entities
          </span>
        </div>

        {/* Pack filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-400 font-medium">Packs:</span>
          {onLoadPack && (
            <button
              onClick={onLoadPack}
              className="px-2 py-0.5 text-xs rounded bg-green-600 hover:bg-green-500 text-white"
            >
              + Load
            </button>
          )}
          {enabledLoadOrder.length > 0 && (
            <>
              <span className="text-zinc-600">|</span>
              <button
                onClick={selectAllPacks}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                All
              </button>
              <button
                onClick={selectNoPacks}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                None
              </button>
              <span className="text-zinc-600">|</span>
            </>
          )}
          {enabledLoadOrder.map((packId) => {
            const pack = packs.get(packId);
            if (!pack) return null;
            const inFilter = packFilter.has(packId);
            return (
              <button
                key={packId}
                onClick={() => togglePack(packId)}
                className={`px-2 py-0.5 text-xs rounded ${
                  inFilter
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-700 text-zinc-400"
                }`}
              >
                {pack.name}
              </button>
            );
          })}
        </div>

        {/* Type filters */}
        {allTypes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400 font-medium">Types:</span>
            <button
              onClick={selectAllTypes}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              All
            </button>
            <button
              onClick={selectNoTypes}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              None
            </button>
            <span className="text-zinc-600">|</span>
            {allTypes.slice(0, 20).map((type) => {
              const enabled = enabledTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-2 py-0.5 text-xs rounded ${
                    enabled
                      ? "bg-green-600 text-white"
                      : "bg-zinc-700 text-zinc-400"
                  }`}
                >
                  {type}
                </button>
              );
            })}
            {allTypes.length > 20 && (
              <span className="text-xs text-zinc-500">
                +{allTypes.length - 20} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Virtualized Table */}
      <div
        ref={tableContainerRef}
        className="relative flex-1 overflow-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-800 z-10 flex border-b border-zinc-700">
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => (
              <div
                key={header.id}
                className="px-2 py-1 text-left text-xs cursor-pointer hover:bg-zinc-700 select-none flex-shrink-0"
                style={{ width: header.getSize() }}
                onClick={header.column.getToggleSortingHandler()}
              >
                <div className="flex items-center gap-1">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {{
                    asc: <span className="text-blue-400">↑</span>,
                    desc: <span className="text-blue-400">↓</span>,
                  }[header.column.getIsSorted() as string] ?? (
                    <span className="text-zinc-600">↕</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rows */}
        <div
          style={{
            height: `${totalSize}px`,
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={row.id}
                data-index={virtualRow.index}
                ref={(node) => rowVirtualizer.measureElement(node)}
                className="flex hover:bg-zinc-700/50 cursor-pointer border-b border-zinc-700/30"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() =>
                  onSelectEntity(row.original.packId, row.original.entityKey)
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="px-2 py-0.5 overflow-hidden flex-shrink-0"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-3">
            {allEntities.length === 0 ? (
              <>
                <span>No content packs loaded</span>
                {onLoadPack && (
                  <button
                    onClick={onLoadPack}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
                  >
                    Load Content Pack
                  </button>
                )}
              </>
            ) : (
              <span>No entities match the current filters</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
