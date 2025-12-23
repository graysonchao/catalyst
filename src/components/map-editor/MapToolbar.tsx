import type { MapTool, ResolvedSymbol } from "../../types";

interface MapToolbarProps {
  tool: MapTool;
  boxFilled: boolean;
  onToolChange: (tool: MapTool) => void;
  onToggleBoxFilled: () => void;
  selectedSymbol: string | null;
  palette: ResolvedSymbol[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function MapToolbar({
  tool,
  boxFilled,
  onToolChange,
  onToggleBoxFilled,
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
          label="Hand"
          shortcut="A"
          icon="✋"
          active={tool === "hand"}
          onClick={() => onToolChange("hand")}
        />
        <ToolButton
          label="Paint"
          shortcut="Q"
          icon="✏️"
          active={tool === "paint"}
          onClick={() => onToolChange("paint")}
        />
        <ToolButton
          label="Line"
          shortcut="W"
          icon="╱"
          active={tool === "line"}
          onClick={() => onToolChange("line")}
        />
        <ToolButton
          label="Box"
          shortcut="E"
          icon={boxFilled ? "▣" : "▢"}
          active={tool === "box"}
          onClick={() => onToolChange("box")}
          secondaryAction={tool === "box" ? onToggleBoxFilled : undefined}
          secondaryLabel={tool === "box" ? (boxFilled ? "Filled" : "Outline") : undefined}
        />
        <ToolButton
          label="Fill"
          shortcut="R"
          icon="🪣"
          active={tool === "fill"}
          onClick={() => onToolChange("fill")}
        />
        <ToolButton
          label="Pick"
          shortcut="S"
          icon="💧"
          active={tool === "eyedropper"}
          onClick={() => onToolChange("eyedropper")}
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
        {tool === "hand" && "Drag to pan, scroll to zoom"}
        {tool === "paint" && "Click and drag to paint (Alt+click: pick)"}
        {tool === "line" && "Click start, then click end"}
        {tool === "box" && (boxFilled ? "Click corners to fill box" : "Click corners for outline")}
        {tool === "fill" && "Click to flood fill"}
        {tool === "eyedropper" && "Click to pick symbol"}
      </div>
    </div>
  );
}

interface ToolButtonProps {
  label: string;
  shortcut: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}

function ToolButton({
  label,
  shortcut,
  icon,
  active,
  onClick,
  secondaryAction,
  secondaryLabel,
}: ToolButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Right click toggles secondary action if available
    if (e.button === 2 && secondaryAction) {
      e.preventDefault();
      secondaryAction();
      return;
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={(e) => {
        if (secondaryAction) {
          e.preventDefault();
          secondaryAction();
        }
      }}
      className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${
        active
          ? "bg-blue-600 text-white"
          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
      }`}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}${secondaryLabel ? ` - ${secondaryLabel}` : ""}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {shortcut && (
        <span className="text-xs opacity-60 ml-0.5">{shortcut}</span>
      )}
    </button>
  );
}
