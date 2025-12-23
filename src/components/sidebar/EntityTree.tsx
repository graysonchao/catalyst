import { useState, useMemo } from "react";
import type { EntityTree, EntityKey, EntitySummary } from "../../types";

interface EntityTreeViewProps {
  entityTree: EntityTree;
  selectedEntityKey: EntityKey | null;
  onSelectEntity: (entityKey: EntityKey) => void;
}

export function EntityTreeView({
  entityTree,
  selectedEntityKey,
  onSelectEntity,
}: EntityTreeViewProps) {
  // Sort entity types alphabetically
  const sortedTypes = useMemo(() => {
    return Object.keys(entityTree.byType).sort();
  }, [entityTree]);

  if (sortedTypes.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-zinc-500">No entities found</div>
    );
  }

  return (
    <div className="py-1">
      {sortedTypes.map((entityType) => (
        <EntityTypeGroup
          key={entityType}
          entityType={entityType}
          entities={entityTree.byType[entityType]}
          selectedEntityKey={selectedEntityKey}
          onSelectEntity={onSelectEntity}
        />
      ))}
    </div>
  );
}

interface EntityTypeGroupProps {
  entityType: string;
  entities: EntitySummary[];
  selectedEntityKey: EntityKey | null;
  onSelectEntity: (entityKey: EntityKey) => void;
}

function EntityTypeGroup({
  entityType,
  entities,
  selectedEntityKey,
  onSelectEntity,
}: EntityTypeGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      {/* Type header */}
      <div
        className="flex items-center px-2 py-0.5 cursor-pointer hover:bg-zinc-800 text-xs"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-zinc-500 mr-1">{isExpanded ? "▼" : "▶"}</span>
        <span className="flex-1 text-zinc-400 font-mono">{entityType}</span>
        <span className="text-zinc-600">{entities.length}</span>
      </div>

      {/* Entities */}
      {isExpanded && (
        <div className="pl-4">
          {entities.map((entity) => (
            <EntityItem
              key={entity.key}
              entity={entity}
              isSelected={entity.key === selectedEntityKey}
              onSelect={() => onSelectEntity(entity.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EntityItemProps {
  entity: EntitySummary;
  isSelected: boolean;
  onSelect: () => void;
}

function EntityItem({ entity, isSelected, onSelect }: EntityItemProps) {
  const displayName = entity.displayName || entity.id;

  return (
    <div
      className={`px-2 py-0.5 cursor-pointer text-xs truncate tree-item ${
        isSelected ? "selected bg-blue-900/30" : ""
      }`}
      onClick={onSelect}
      title={`${entity.id}\n${entity.sourceFile}`}
    >
      <span className={entity.dirty ? "text-amber-400" : "text-zinc-300"}>
        {displayName}
      </span>
      {entity.dirty && <span className="text-amber-400 ml-1">*</span>}
    </div>
  );
}
