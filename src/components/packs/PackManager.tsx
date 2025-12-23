import { useMemo, useCallback } from "react";
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ModDirectoriesPanel
        modDirectories={modDirectories}
        gameModsPath={gameModsPath}
        onAddDirectory={onAddModDirectory}
        onRemoveDirectory={onRemoveModDirectory}
      />
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-lg font-semibold mb-3">Content Packs</h2>

        {sortedLoadOrder.length === 0 ? (
          <div className="text-zinc-500 text-sm">No content packs loaded</div>
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
                {sortedLoadOrder.map((packId) => {
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
