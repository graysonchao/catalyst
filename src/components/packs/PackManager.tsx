import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import type { PackId } from "../../types";
import type { LoadedPack } from "../../hooks/useWorkspace";
import { ModDirectoriesPanel } from "./ModDirectoriesPanel";

interface PackManagerProps {
  packs: Map<PackId, LoadedPack>;
  loadOrder: PackId[];
  enabledPacks: Set<PackId>;
  modDirectories: string[];
  gameModsPath: string | null;
  onSetPackEnabled: (packId: PackId, enabled: boolean) => void;
  onClosePack: (packId: PackId) => Promise<void>;
  onAddModDirectory: () => Promise<string | null>;
  onRemoveModDirectory: (path: string) => Promise<void>;
}

export function PackManager({
  packs,
  loadOrder,
  enabledPacks,
  modDirectories,
  gameModsPath,
  onSetPackEnabled,
  onClosePack,
  onAddModDirectory,
  onRemoveModDirectory,
}: PackManagerProps) {
  // Get set of loaded mod IDs for dependency checking
  const loadedModIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pack of packs.values()) {
      if (pack.metadata?.modId) {
        ids.add(pack.metadata.modId);
      }
    }
    return ids;
  }, [packs]);

  // Get enabled mod IDs
  const enabledModIds = useMemo(() => {
    const ids = new Set<string>();
    for (const packId of enabledPacks) {
      const pack = packs.get(packId);
      if (pack?.metadata?.modId) {
        ids.add(pack.metadata.modId);
      }
    }
    return ids;
  }, [packs, enabledPacks]);

  const getDependencyStatus = useCallback((dep: string): "enabled" | "disabled" | "missing" => {
    if (enabledModIds.has(dep)) return "enabled";
    if (loadedModIds.has(dep)) return "disabled";
    return "missing";
  }, [enabledModIds, loadedModIds]);

  const getDependencyColor = (status: "enabled" | "disabled" | "missing") => {
    switch (status) {
      case "enabled": return "text-green-400";
      case "disabled": return "text-zinc-500";
      case "missing": return "text-red-400";
    }
  };

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(new Set());
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoriesInitialized = useRef(false);

  // Get all unique categories
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const pack of packs.values()) {
      if (pack.metadata?.category) {
        categories.add(pack.metadata.category);
      }
    }
    return Array.from(categories).sort();
  }, [packs]);

  // Initialize category filters when data loads
  useEffect(() => {
    if (!categoriesInitialized.current && allCategories.length > 0) {
      setEnabledCategories(new Set(allCategories));
      categoriesInitialized.current = true;
    }
  }, [allCategories]);

  // Sort load order to pin "Bright Nights" to top
  const sortedLoadOrder = useMemo(() => {
    return [...loadOrder].sort((a, b) => {
      const packA = packs.get(a);
      const packB = packs.get(b);
      const isBaseA = packA?.name === "Bright Nights";
      const isBaseB = packB?.name === "Bright Nights";
      if (isBaseA && !isBaseB) return -1;
      if (!isBaseA && isBaseB) return 1;
      return 0;
    });
  }, [loadOrder, packs]);

  // Filter packs
  const filteredLoadOrder = useMemo(() => {
    return sortedLoadOrder.filter((packId) => {
      const pack = packs.get(packId);
      if (!pack) return false;

      // Category filter
      const category = pack.metadata?.category;
      if (category && enabledCategories.size > 0 && enabledCategories.size < allCategories.length) {
        if (!enabledCategories.has(category)) return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = pack.name.toLowerCase().includes(q);
        const matchesId = pack.metadata?.modId?.toLowerCase().includes(q);
        const matchesPath = pack.path.toLowerCase().includes(q);
        const matchesAuthors = pack.metadata?.authors?.some(a => a.toLowerCase().includes(q));
        const matchesDescription = pack.metadata?.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesPath && !matchesAuthors && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [sortedLoadOrder, packs, searchQuery, enabledCategories, allCategories.length]);

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

  const toggleCategory = useCallback((category: string) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const selectAllCategories = useCallback(() => {
    setEnabledCategories(new Set(allCategories));
  }, [allCategories]);

  const selectNoCategories = useCallback(() => {
    setEnabledCategories(new Set());
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ModDirectoriesPanel
        modDirectories={modDirectories}
        gameModsPath={gameModsPath}
        onAddDirectory={onAddModDirectory}
        onRemoveDirectory={onRemoveModDirectory}
      />
      {/* Filter Controls */}
      <div className="border-b border-zinc-700 bg-zinc-800 p-3 space-y-3 flex-shrink-0">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search packs... (Cmd+F)"
            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm focus:outline-none focus:border-blue-500"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          <span className="text-xs text-zinc-500">
            {filteredLoadOrder.length} / {loadOrder.length} packs
          </span>
        </div>

        {/* Category filters */}
        {allCategories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400 font-medium">Categories:</span>
            <button
              onClick={selectAllCategories}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              All
            </button>
            <button
              onClick={selectNoCategories}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              None
            </button>
            <span className="text-zinc-600">|</span>
            {allCategories.map((category) => {
              const enabled = enabledCategories.has(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-2 py-0.5 text-xs rounded ${
                    enabled
                      ? "bg-green-600 text-white"
                      : "bg-zinc-700 text-zinc-400"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-lg font-semibold mb-3">Content Packs</h2>

        {filteredLoadOrder.length === 0 ? (
          <div className="text-zinc-500 text-sm">
            {loadOrder.length === 0 ? "No content packs loaded" : "No packs match the current filters"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-zinc-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left w-12">On</th>
                  <th className="px-2 py-1 text-left">ID</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Path</th>
                  <th className="px-2 py-1 text-left">Version</th>
                  <th className="px-2 py-1 text-left">Category</th>
                  <th className="px-2 py-1 text-left">Authors</th>
                  <th className="px-2 py-1 text-left">Dependencies</th>
                  <th className="px-2 py-1 text-left w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoadOrder.map((packId) => {
                  const pack = packs.get(packId);
                  if (!pack) return null;
                  const meta = pack.metadata;
                  const isEnabled = enabledPacks.has(packId);

                  return (
                    <tr key={packId} className="border-b border-zinc-700/50 hover:bg-zinc-700/30">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => onSetPackEnabled(packId, e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-xs text-zinc-300">
                        {meta?.modId ?? "-"}
                      </td>
                      <td className="px-2 py-1">
                        <span className={isEnabled ? "text-zinc-100" : "text-zinc-500"}>
                          {pack.name}
                        </span>
                        {meta?.description && (
                          <div className="text-xs text-zinc-500 truncate max-w-xs" title={meta.description}>
                            {meta.description}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs text-zinc-400">
                        <span className="truncate max-w-xs block" title={pack.path}>
                          {pack.path}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-xs text-zinc-400">
                        {meta?.version ?? "-"}
                        {meta?.luaApiVersion && (
                          <span className="ml-1 text-zinc-600">(Lua: {meta.luaApiVersion})</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs text-zinc-400">
                        {meta?.category ?? "-"}
                      </td>
                      <td className="px-2 py-1 text-xs text-zinc-400">
                        {meta?.authors?.length ? meta.authors.join(", ") : "-"}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {meta?.dependencies?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {meta.dependencies.map((dep) => {
                              const status = getDependencyStatus(dep);
                              return (
                                <span
                                  key={dep}
                                  className={`px-1 py-0.5 rounded bg-zinc-800 ${getDependencyColor(status)}`}
                                  title={`${dep}: ${status}`}
                                >
                                  {dep}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <button
                          onClick={() => onClosePack(packId)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Unload
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
