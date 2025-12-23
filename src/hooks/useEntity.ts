import { useState, useCallback, useEffect } from "react";
import * as api from "../services/api";
import type {
  PackId,
  EntityKey,
  EntityData,
  UpdateResult,
  ValidationResult,
} from "../types";

export interface EntityHook {
  entity: EntityData | null;
  loading: boolean;
  error: string | null;
  editorContent: string;
  validation: ValidationResult | null;
  isDirty: boolean;
  setEditorContent: (content: string) => void;
  saveEntity: () => Promise<UpdateResult | null>;
  revertChanges: () => void;
}

export function useEntity(
  packId: PackId | null,
  entityKey: EntityKey | null
): EntityHook {
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorContent, setEditorContentState] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Load entity when selection changes
  useEffect(() => {
    if (!packId || !entityKey) {
      setEntity(null);
      setEditorContentState("");
      setOriginalContent("");
      setValidation(null);
      return;
    }

    let cancelled = false;

    const loadEntity = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.getEntity(packId, entityKey);
        if (!cancelled) {
          setEntity(data);
          setEditorContentState(data.jsonText);
          setOriginalContent(data.jsonText);
          setValidation(null);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEntity();

    return () => {
      cancelled = true;
    };
  }, [packId, entityKey]);

  const setEditorContent = useCallback((content: string) => {
    setEditorContentState(content);
    // Clear validation when content changes
    setValidation(null);
  }, []);

  const saveEntity = useCallback(async (): Promise<UpdateResult | null> => {
    if (!packId || !entityKey || !entity) {
      return null;
    }

    try {
      const result = await api.updateEntity(packId, entityKey, editorContent);
      setValidation(result.validation);

      if (result.accepted) {
        // Update original content to new saved content
        setOriginalContent(editorContent);

        // Update entity metadata if changed
        if (result.meta) {
          setEntity((prev) =>
            prev
              ? {
                  ...prev,
                  meta: result.meta!,
                  key: result.newKey || prev.key,
                  dirty: true,
                }
              : null
          );
        }
      }

      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      return null;
    }
  }, [packId, entityKey, entity, editorContent]);

  const revertChanges = useCallback(() => {
    setEditorContentState(originalContent);
    setValidation(null);
  }, [originalContent]);

  const isDirty = editorContent !== originalContent;

  return {
    entity,
    loading,
    error,
    editorContent,
    validation,
    isDirty,
    setEditorContent,
    saveEntity,
    revertChanges,
  };
}
