import { useState, useCallback, useEffect } from "react";
import { getEntity, updateEntity, savePack } from "../services/api";
import type { PackId, EntityKey, EntityData, ValidationResult, UpdateResult } from "../types";
import type { EditorTab } from "../components/editor/EditorTabs";

interface TabState {
  tab: EditorTab;
  entity: EntityData | null;
  editorContent: string;
  validation: ValidationResult | null;
  loading: boolean;
  error: string | null;
}

interface UseEditorTabsResult {
  tabs: EditorTab[];
  activeTabId: string | null;
  activeTabState: TabState | null;

  openTab: (packId: PackId, entityKey: EntityKey, label: string) => void;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string) => void;

  // Editor operations for active tab
  setEditorContent: (content: string) => void;
  saveEntity: () => Promise<UpdateResult | null>;
  revertChanges: () => void;
  saveToDisk: () => Promise<void>;
}

export function useEditorTabs(): UseEditorTabsResult {
  const [tabStates, setTabStates] = useState<Map<string, TabState>>(new Map());
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const tabs = Array.from(tabStates.values()).map((s) => s.tab);
  const activeTabState = activeTabId ? tabStates.get(activeTabId) ?? null : null;

  // Generate unique tab ID
  const makeTabId = (packId: PackId, entityKey: EntityKey) => `${packId}:${entityKey}`;

  // Open a new tab or switch to existing
  const openTab = useCallback((packId: PackId, entityKey: EntityKey, label: string) => {
    const tabId = makeTabId(packId, entityKey);

    setTabStates((prev) => {
      if (prev.has(tabId)) {
        // Tab already open, just switch to it
        return prev;
      }

      // Create new tab state
      const newState: TabState = {
        tab: {
          id: tabId,
          packId,
          entityKey,
          label,
          isDirty: false,
        },
        entity: null,
        editorContent: "",
        validation: null,
        loading: true,
        error: null,
      };

      const next = new Map(prev);
      next.set(tabId, newState);
      return next;
    });

    setActiveTabId(tabId);
  }, []);

  // Close a tab
  const closeTab = useCallback((tabId: string) => {
    setTabStates((prev) => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });

    // If closing active tab, switch to another
    setActiveTabId((current) => {
      if (current !== tabId) return current;
      const remaining = Array.from(tabStates.keys()).filter((id) => id !== tabId);
      return remaining.length > 0 ? remaining[remaining.length - 1] : null;
    });
  }, [tabStates]);

  // Select a tab
  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Fetch entity data when tab is opened
  useEffect(() => {
    tabStates.forEach((state, tabId) => {
      if (state.loading && !state.entity && !state.error) {
        // Fetch entity data
        getEntity(state.tab.packId, state.tab.entityKey)
          .then((entity) => {
            setTabStates((prev) => {
              const next = new Map(prev);
              const existing = next.get(tabId);
              if (existing) {
                next.set(tabId, {
                  ...existing,
                  entity,
                  editorContent: entity.jsonText,
                  loading: false,
                });
              }
              return next;
            });
          })
          .catch((err) => {
            setTabStates((prev) => {
              const next = new Map(prev);
              const existing = next.get(tabId);
              if (existing) {
                next.set(tabId, {
                  ...existing,
                  error: String(err),
                  loading: false,
                });
              }
              return next;
            });
          });
      }
    });
  }, [tabStates]);

  // Update editor content for active tab
  const setEditorContent = useCallback((content: string) => {
    if (!activeTabId) return;

    setTabStates((prev) => {
      const next = new Map(prev);
      const state = next.get(activeTabId);
      if (state) {
        const isDirty = state.entity ? content !== state.entity.jsonText : false;
        next.set(activeTabId, {
          ...state,
          editorContent: content,
          tab: { ...state.tab, isDirty },
        });
      }
      return next;
    });
  }, [activeTabId]);

  // Save entity to memory
  const saveEntity = useCallback(async (): Promise<UpdateResult | null> => {
    if (!activeTabId) return null;

    const state = tabStates.get(activeTabId);
    if (!state?.entity) return null;

    try {
      const result = await updateEntity(
        state.tab.packId,
        state.tab.entityKey,
        state.editorContent
      );

      setTabStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(activeTabId);
        if (existing) {
          next.set(activeTabId, {
            ...existing,
            validation: result.validation,
            tab: {
              ...existing.tab,
              isDirty: !result.accepted,
              // Update key if it changed
              entityKey: result.newKey || existing.tab.entityKey,
            },
          });
        }
        return next;
      });

      return result;
    } catch (err) {
      console.error("Failed to save entity:", err);
      return null;
    }
  }, [activeTabId, tabStates]);

  // Revert changes
  const revertChanges = useCallback(() => {
    if (!activeTabId) return;

    setTabStates((prev) => {
      const next = new Map(prev);
      const state = next.get(activeTabId);
      if (state?.entity) {
        next.set(activeTabId, {
          ...state,
          editorContent: state.entity.jsonText,
          validation: null,
          tab: { ...state.tab, isDirty: false },
        });
      }
      return next;
    });
  }, [activeTabId]);

  // Save to disk
  const saveToDisk = useCallback(async () => {
    if (!activeTabId) return;

    const state = tabStates.get(activeTabId);
    if (!state) return;

    try {
      const result = await savePack(state.tab.packId);
      if (result.entitiesSaved > 0) {
        console.log(`Saved ${result.entitiesSaved} entities`);
      }
    } catch (err) {
      console.error("Failed to save to disk:", err);
    }
  }, [activeTabId, tabStates]);

  return {
    tabs,
    activeTabId,
    activeTabState,
    openTab,
    closeTab,
    selectTab,
    setEditorContent,
    saveEntity,
    revertChanges,
    saveToDisk,
  };
}
