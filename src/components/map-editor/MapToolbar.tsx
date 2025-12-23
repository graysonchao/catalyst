import type { MapTool, ResolvedSymbol } from "../../types";

interface MapToolbarProps {
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  selectedSymbol: string | null;
  palette: ResolvedSymbol[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function MapToolbar({
  tool,
  onToolChange,
  selectedSymbol,
  palette,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: MapToolbarProps) {
  const selectedMapping = selectedSymbol
    ? palette.find((p) => p.symbol === selectedSymbol)
    : null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-700 bg-zinc-800">
      {/* Undo/Redo buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-2 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 rounded"
          title="Undo (Cmd+Z)"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-2 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 rounded"
          title="Redo (Cmd+Shift+Z)"
        >
          ↷
        </button>
      </div>

      <div className="h-4 w-px bg-zinc-600" />

      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        <ToolButton
          label="Paint"
          icon="✏️"
          active={tool === "paint"}
          onClick={() => onToolChange("paint")}
        />
        <ToolButton
          label="Line"
          icon="╱"
          active={tool === "line"}
          onClick={() => onToolChange("line")}
        />
        <ToolButton
          label="Box"
          icon="▢"
          active={tool === "box"}
          onClick={() => onToolChange("box")}
        />
      </div>

      <div className="h-4 w-px bg-zinc-600" />

      {/* Selected symbol info */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-400">Selected:</span>
        {selectedMapping ? (
          <>
            <span className="font-mono bg-zinc-700 px-2 py-0.5 rounded text-zinc-100">
              {selectedMapping.symbol}
            </span>
            <span className="text-zinc-300">
              {selectedMapping.terrain ?? "(no terrain)"}
            </span>
            {selectedMapping.furniture && (
              <span className="text-zinc-400">+ {selectedMapping.furniture}</span>
            )}
          </>
        ) : (
          <span className="text-zinc-500">None - click palette to select</span>
        )}
      </div>

      {/* Tool hint */}
      <div className="ml-auto text-xs text-zinc-500">
        {tool === "paint" && "Click and drag to paint"}
        {tool === "line" && "Click start point, then click end point"}
        {tool === "box" && "Click corner, then click opposite corner"}
      </div>
    </div>
  );
}

interface ToolButtonProps {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ label, icon, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${
        active
          ? "bg-blue-600 text-white"
          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
      }`}
      title={label}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
