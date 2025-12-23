import { useState, useMemo } from "react";
import type { PackId, EntityKey } from "../../types";
import type { LoadedPack } from "../../hooks/useWorkspace";
import { EntityTreeView } from "./EntityTree";

interface PackListProps {
  packs: Map<PackId, LoadedPack>;
  loadOrder: PackId[];
  enabledPacks: Set<PackId>;
  selectedPackId: PackId | null;
  selectedEntityKey: EntityKey | null;
  onSelectEntity: (packId: PackId, entityKey: EntityKey) => void;
  onLoadPack: () => void;
  onClosePack: (packId: PackId) => void;
}

export function PackList({
  packs,
  loadOrder,
  enabledPacks,
  selectedPackId,
  selectedEntityKey,
  onSelectEntity,
  onLoadPack,
  onClosePack,
}: PackListProps) {
  // Filter to only show enabled packs
  const enabledLoadOrder = useMemo(() => {
    return loadOrder.filter((packId) => enabledPacks.has(packId));
  }, [loadOrder, enabledPacks]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <span className="text-sm font-medium text-zinc-300">Content Packs</span>
        <button
          onClick={onLoadPack}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          + Load
        </button>
      </div>

      {/* Pack list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {enabledLoadOrder.length === 0 ? (
          <div className="px-3 py-8 text-center text-zinc-500 text-sm">
            No packs enabled.
            <br />
            Enable packs in the Packs tab.
          </div>
        ) : (
          enabledLoadOrder.map((packId) => {
            const pack = packs.get(packId);
            if (!pack) return null;
            return (
              <PackItem
                key={packId}
                pack={pack}
                isSelected={packId === selectedPackId}
                selectedEntityKey={
                  packId === selectedPackId ? selectedEntityKey : null
                }
                onSelectEntity={(entityKey) => onSelectEntity(packId, entityKey)}
                onClose={() => onClosePack(packId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface PackItemProps {
  pack: LoadedPack;
  isSelected: boolean;
  selectedEntityKey: EntityKey | null;
  onSelectEntity: (entityKey: EntityKey) => void;
  onClose: () => void;
}

function PackItem({
  pack,
  isSelected,
  selectedEntityKey,
  onSelectEntity,
  onClose,
}: PackItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-b border-zinc-800">
      {/* Pack header */}
      <div
        className={`flex items-center px-2 py-1.5 cursor-pointer hover:bg-zinc-800 ${
          isSelected ? "bg-zinc-800" : ""
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-zinc-500 mr-1 text-xs">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span className="flex-1 text-sm text-zinc-200 truncate">{pack.name}</span>
        {pack.readOnly && (
          <span className="text-xs text-zinc-500 mr-2">(read-only)</span>
        )}
        <span className="text-xs text-zinc-500">{pack.entityCount}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-2 text-zinc-500 hover:text-red-400 text-xs"
          title="Close pack"
        >
          ×
        </button>
      </div>

      {/* Entity tree */}
      {isExpanded && (
        <div className="pl-2">
          <EntityTreeView
            entityTree={pack.entityTree}
            selectedEntityKey={selectedEntityKey}
            onSelectEntity={onSelectEntity}
          />
        </div>
      )}
    </div>
  );
}
