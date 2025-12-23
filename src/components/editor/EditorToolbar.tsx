interface EditorToolbarProps {
  entityName: string | null;
  entityType: string | null;
  sourceFile: string | null;
  isDirty: boolean;
  isReadOnly: boolean;
  onSave: () => void;
  onRevert: () => void;
  onFormat: () => void;
}

export function EditorToolbar({
  entityName,
  entityType,
  sourceFile,
  isDirty,
  isReadOnly,
  onSave,
  onRevert,
  onFormat,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-700">
      {/* Entity info */}
      <div className="flex items-center gap-2 min-w-0">
        {entityName ? (
          <>
            <span className="text-sm text-zinc-200 truncate">
              {entityName}
              {isDirty && <span className="text-amber-400 ml-1">*</span>}
            </span>
            <span className="text-xs text-zinc-500 font-mono">{entityType}</span>
            {sourceFile && (
              <span className="text-xs text-zinc-600 truncate" title={sourceFile}>
                {sourceFile}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-zinc-500">No entity selected</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onFormat}
          disabled={!entityName}
          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 rounded transition-colors"
          title="Format JSON (Ctrl+Shift+F)"
        >
          Format
        </button>
        <button
          onClick={onRevert}
          disabled={!isDirty}
          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 rounded transition-colors"
          title="Revert changes"
        >
          Revert
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || isReadOnly}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          title={isReadOnly ? "Pack is read-only" : "Save changes (Ctrl+S)"}
        >
          Save
        </button>
      </div>
    </div>
  );
}
