interface ModDirectoriesPanelProps {
  modDirectories: string[];
  gameModsPath: string | null;
  onAddDirectory: () => Promise<string | null>;
  onRemoveDirectory: (path: string) => Promise<void>;
}

export function ModDirectoriesPanel({
  modDirectories,
  gameModsPath,
  onAddDirectory,
  onRemoveDirectory,
}: ModDirectoriesPanelProps) {
  return (
    <div className="p-3 border-b border-zinc-700 bg-zinc-800/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-300">Mod Directories</h3>
        <button
          onClick={onAddDirectory}
          className="px-2 py-0.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded"
        >
          + Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {gameModsPath && (
          <div className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 rounded">
            <span className="text-zinc-400" title={gameModsPath}>
              {gameModsPath.split("/").pop() || gameModsPath}
            </span>
            <span className="text-zinc-500">(game)</span>
          </div>
        )}
        {modDirectories.map((dir) => (
          <div
            key={dir}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 rounded"
          >
            <span className="text-zinc-300" title={dir}>
              {dir.split("/").pop() || dir}
            </span>
            <button
              onClick={() => onRemoveDirectory(dir)}
              className="text-zinc-500 hover:text-red-400 ml-1"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {!gameModsPath && modDirectories.length === 0 && (
          <span className="text-xs text-zinc-500">
            No mod directories configured
          </span>
        )}
      </div>
    </div>
  );
}
