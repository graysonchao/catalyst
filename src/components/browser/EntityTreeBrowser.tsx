import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PackId, EntityKey, EntitySummary } from "../../types";
import type { LoadedPack } from "../../hooks/useWorkspace";

interface EntityTreeBrowserProps {
  packs: Map<PackId, LoadedPack>;
  loadOrder: PackId[];
  enabledPacks: Set<PackId>;
  onSelectEntity: (packId: PackId, entityKey: EntityKey) => void;
  onLoadPack?: () => void;
}

// Row types for virtualization
type TreeRow =
  | { type: "pack"; packId: PackId; pack: LoadedPack; entityCount: number; matchCount?: number }
  | { type: "file"; packId: PackId; filePath: string; entities: EntitySummary[]; matchCount?: number }
  | { type: "entity"; packId: PackId; entity: EntitySummary };

export function EntityTreeBrowser({
  packs,
  loadOrder,
  enabledPacks,
  onSelectEntity,
  onLoadPack,
}: EntityTreeBrowserProps) {
  // Filter state
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tree expansion state - manage inline for simplicity
  const [collapsedPacks, setCollapsedPacks] = useState<Set<PackId>>(new Set());
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set()); // "packId:filePath"

  // Virtualization ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter to only globally enabled packs
  const enabledLoadOrder = useMemo(() => {
    return loadOrder.filter((packId) => enabledPacks.has(packId));
  }, [loadOrder, enabledPacks]);

  // Get all unique types across all enabled packs
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const packId of enabledLoadOrder) {
      const pack = packs.get(packId);
      if (!pack) continue;
      for (const entityType of Object.keys(pack.entityTree.byType)) {
        types.add(entityType);
      }
    }
    return Array.from(types).sort();
  }, [packs, enabledLoadOrder]);

  // Track if we've initialized filters
  const typesInitialized = useRef(false);

  // Initialize enabled types when data loads
  useEffect(() => {
    if (!typesInitialized.current && allTypes.length > 0) {
      setEnabledTypes(new Set(allTypes));
      typesInitialized.current = true;
    }
  }, [allTypes]);

  // Expansion helpers - use "collapsed" set so default is expanded
  const isPackExpanded = useCallback(
    (packId: PackId) => !collapsedPacks.has(packId),
    [collapsedPacks]
  );

  const isFileExpanded = useCallback(
    (packId: PackId, filePath: string) => !collapsedFiles.has(`${packId}:${filePath}`),
    [collapsedFiles]
  );

  const togglePackExpanded = useCallback((packId: PackId) => {
    setCollapsedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }, []);

  const toggleFileExpanded = useCallback((packId: PackId, filePath: string) => {
    const key = `${packId}:${filePath}`;
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedPacks(new Set());
    setCollapsedFiles(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    // Collapse all packs
    setCollapsedPacks(new Set(enabledLoadOrder));
    // Also collapse all files
    const allFileKeys: string[] = [];
    for (const packId of enabledLoadOrder) {
      const pack = packs.get(packId);
      if (!pack) continue;
      for (const filePath of Object.keys(pack.entityTree.byFile)) {
        allFileKeys.push(`${packId}:${filePath}`);
      }
    }
    setCollapsedFiles(new Set(allFileKeys));
  }, [enabledLoadOrder, packs]);

  // Filter function for entities
  const entityMatchesFilters = useCallback(
    (entity: EntitySummary): boolean => {
      // Type filter
      if (enabledTypes.size < allTypes.length && !enabledTypes.has(entity.entityType)) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          entity.id.toLowerCase().includes(q) ||
          entity.entityType.toLowerCase().includes(q) ||
          entity.displayName?.toLowerCase().includes(q) ||
          entity.sourceFile.toLowerCase().includes(q)
        );
      }
      return true;
    },
    [enabledTypes, allTypes.length, searchQuery]
  );

  // Build flattened row list for virtualization
  const rows = useMemo((): TreeRow[] => {
    const result: TreeRow[] = [];

    for (const packId of enabledLoadOrder) {
      const pack = packs.get(packId);
      if (!pack) continue;

      // Count total entities and matching entities for this pack
      let totalCount = 0;
      let matchCount = 0;
      const byFile = pack.entityTree.byFile;

      for (const entities of Object.values(byFile)) {
        totalCount += entities.length;
        matchCount += entities.filter(entityMatchesFilters).length;
      }

      // Add pack row
      result.push({
        type: "pack",
        packId,
        pack,
        entityCount: totalCount,
        matchCount: searchQuery || enabledTypes.size < allTypes.length ? matchCount : undefined,
      });

      // If pack is expanded, add file rows
      if (isPackExpanded(packId)) {
        // Sort files by path
        const filePaths = Object.keys(byFile).sort();

        for (const filePath of filePaths) {
          const entities = byFile[filePath];
          const matchingEntities = entities.filter(entityMatchesFilters);

          // Skip files with no matching entities when filtering
          if ((searchQuery || enabledTypes.size < allTypes.length) && matchingEntities.length === 0) {
            continue;
          }

          // Add file row
          result.push({
            type: "file",
            packId,
            filePath,
            entities,
            matchCount: searchQuery || enabledTypes.size < allTypes.length ? matchingEntities.length : undefined,
          });

          // If file is expanded, add entity rows
          if (isFileExpanded(packId, filePath)) {
            for (const entity of entities) {
              if (entityMatchesFilters(entity)) {
                result.push({
                  type: "entity",
                  packId,
                  entity,
                });
              }
            }
          }
        }
      }
    }

    return result;
  }, [
    enabledLoadOrder,
    packs,
    isPackExpanded,
    isFileExpanded,
    entityMatchesFilters,
    searchQuery,
    enabledTypes.size,
    allTypes.length,
  ]);

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

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

  const selectAllTypes = useCallback(() => {
    setEnabledTypes(new Set(allTypes));
  }, [allTypes]);

  const selectNoTypes = useCallback(() => {
    setEnabledTypes(new Set());
  }, []);

  // Count total visible entities
  const visibleEntityCount = useMemo(() => {
    return rows.filter((r) => r.type === "entity").length;
  }, [rows]);

  const totalEntityCount = useMemo(() => {
    let count = 0;
    for (const packId of enabledLoadOrder) {
      const pack = packs.get(packId);
      if (!pack) continue;
      for (const entities of Object.values(pack.entityTree.byFile)) {
        count += entities.length;
      }
    }
    return count;
  }, [packs, enabledLoadOrder]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel: Type filters */}
      <div className="w-[15%] min-w-32 flex-shrink-0 border-r border-zinc-700 bg-zinc-800 flex flex-col">
        <div className="px-2 py-1.5 border-b border-zinc-700 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Types</span>
          <div className="flex gap-1">
            <button
              onClick={selectAllTypes}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              All
            </button>
            <span className="text-zinc-600">/</span>
            <button
              onClick={selectNoTypes}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              None
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {allTypes.map((type) => {
            const enabled = enabledTypes.has(type);
            return (
              <label
                key={type}
                className="flex items-center gap-2 px-2 py-0.5 hover:bg-zinc-700/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleType(type)}
                  className="w-3 h-3"
                />
                <span className={`text-xs truncate ${enabled ? "text-zinc-200" : "text-zinc-500"}`}>
                  {type}
                </span>
              </label>
            );
          })}
        </div>
        <div className="px-2 py-1 border-t border-zinc-700 text-xs text-zinc-500">
          {enabledTypes.size} / {allTypes.length} types
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="border-b border-zinc-700 bg-zinc-800 p-3 flex items-center gap-2">
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
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded"
              title="Expand all packs and files"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded"
              title="Collapse all"
            >
              Collapse
            </button>
          </div>
          <span className="text-xs text-zinc-500">
            {visibleEntityCount.toLocaleString()} / {totalEntityCount.toLocaleString()} entities
          </span>
          {onLoadPack && (
            <button
              onClick={onLoadPack}
              className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white"
            >
              + Load Pack
            </button>
          )}
        </div>

        {/* Tree view */}
        <div ref={containerRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={(node) => rowVirtualizer.measureElement(node)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.type === "pack" && (
                    <PackRow
                      row={row}
                      isExpanded={isPackExpanded(row.packId)}
                      onToggle={() => togglePackExpanded(row.packId)}
                    />
                  )}
                  {row.type === "file" && (
                    <FileRow
                      row={row}
                      isExpanded={isFileExpanded(row.packId, row.filePath)}
                      onToggle={() => toggleFileExpanded(row.packId, row.filePath)}
                    />
                  )}
                  {row.type === "entity" && (
                    <EntityRow
                      row={row}
                      onSelect={() => onSelectEntity(row.packId, row.entity.key)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-3">
              {enabledLoadOrder.length === 0 ? (
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
    </div>
  );
}

// Pack row component
function PackRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: Extract<TreeRow, { type: "pack" }>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-700/50 cursor-pointer border-b border-zinc-700/30"
      onClick={onToggle}
    >
      <span className="text-zinc-400 w-4 text-center">{isExpanded ? "▼" : "▶"}</span>
      <span className="text-sm">📦</span>
      <span className="font-medium text-zinc-200 truncate">{row.pack.name}</span>
      <span className="text-xs text-zinc-500 ml-auto">
        {row.matchCount !== undefined ? (
          <>{row.matchCount.toLocaleString()} / {row.entityCount.toLocaleString()}</>
        ) : (
          <>{row.entityCount.toLocaleString()} entities</>
        )}
      </span>
    </div>
  );
}

// File row component
function FileRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: Extract<TreeRow, { type: "file" }>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const fileName = row.filePath.split("/").pop() || row.filePath;
  return (
    <div
      className="flex items-center gap-2 px-2 py-0.5 hover:bg-zinc-700/50 cursor-pointer pl-6"
      onClick={onToggle}
    >
      <span className="text-zinc-400 w-4 text-center text-xs">{isExpanded ? "▼" : "▶"}</span>
      <span className="text-xs">📄</span>
      <span className="text-xs text-zinc-300 truncate" title={row.filePath}>
        {fileName}
      </span>
      <span className="text-xs text-zinc-500 ml-auto">
        {row.matchCount !== undefined ? (
          <>{row.matchCount} / {row.entities.length}</>
        ) : (
          <>{row.entities.length}</>
        )}
      </span>
    </div>
  );
}

// Entity row component
function EntityRow({
  row,
  onSelect,
}: {
  row: Extract<TreeRow, { type: "entity" }>;
  onSelect: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-0.5 hover:bg-zinc-700/50 cursor-pointer pl-12"
      onClick={onSelect}
    >
      <span className="px-1 py-0.5 bg-zinc-700 rounded text-xs truncate">
        {row.entity.entityType}
      </span>
      <span className="font-mono text-xs text-zinc-200 truncate">{row.entity.id}</span>
      {row.entity.displayName && (
        <span className="text-xs text-zinc-400 truncate">"{row.entity.displayName}"</span>
      )}
      {row.entity.dirty && (
        <span className="text-xs text-yellow-500 ml-auto">●</span>
      )}
    </div>
  );
}
