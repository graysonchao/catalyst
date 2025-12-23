import { useCallback } from "react";
import { JsonEditor } from "./JsonEditor";
import { EditorToolbar } from "./EditorToolbar";
import { ValidationDisplay } from "./ValidationDisplay";
import type { EntityHook } from "../../hooks/useEntity";

interface EntityEditorProps {
  entityHook: EntityHook;
  onSaveToDisk?: () => Promise<void>;
}

export function EntityEditor({ entityHook, onSaveToDisk }: EntityEditorProps) {
  const {
    entity,
    loading,
    error,
    editorContent,
    validation,
    isDirty,
    setEditorContent,
    saveEntity,
    revertChanges,
  } = entityHook;

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(editorContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditorContent(formatted);
    } catch {
      // Invalid JSON, can't format
    }
  }, [editorContent, setEditorContent]);

  const handleSave = useCallback(async () => {
    const result = await saveEntity();
    if (result?.accepted && onSaveToDisk) {
      await onSaveToDisk();
    }
  }, [saveEntity, onSaveToDisk]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400">
        Error: {error}
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Select an entity to edit
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar
        entityName={entity.meta.displayName || entity.meta.id}
        entityType={entity.meta.entityType}
        sourceFile={entity.sourceFile}
        isDirty={isDirty}
        isReadOnly={entity.readOnly}
        onSave={handleSave}
        onRevert={revertChanges}
        onFormat={handleFormat}
      />

      <div className="flex-1 overflow-hidden">
        <JsonEditor
          value={editorContent}
          onChange={setEditorContent}
          readOnly={entity.readOnly}
        />
      </div>

      <ValidationDisplay validation={validation} />
    </div>
  );
}
