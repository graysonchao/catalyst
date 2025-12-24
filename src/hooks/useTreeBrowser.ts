import { useState, useCallback, useMemo } from "react";
import type { PackId } from "../types";

export type ViewMode = "list" | "tree";

interface TreeBrowserState {
  expandedPacks: Set<PackId>;
  expandedFiles: Set<string>; // Format: "packId:filePath"
  viewMode: ViewMode;
}

export function useTreeBrowser() {
  const [expandedPacks, setExpandedPacks] = useState<Set<PackId>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("tree");

  const togglePackExpanded = useCallback((packId: PackId) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }, []);

  const toggleFileExpanded = useCallback((packId: PackId, filePath: string) => {
    const key = `${packId}:${filePath}`;
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const isPackExpanded = useCallback(
    (packId: PackId) => expandedPacks.has(packId),
    [expandedPacks]
  );

  const isFileExpanded = useCallback(
    (packId: PackId, filePath: string) => expandedFiles.has(`${packId}:${filePath}`),
    [expandedFiles]
  );

  const expandAllPacks = useCallback((packIds: PackId[]) => {
    setExpandedPacks(new Set(packIds));
  }, []);

  const collapseAllPacks = useCallback(() => {
    setExpandedPacks(new Set());
    setExpandedFiles(new Set());
  }, []);

  const expandAllFilesInPack = useCallback((packId: PackId, filePaths: string[]) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      for (const filePath of filePaths) {
        next.add(`${packId}:${filePath}`);
      }
      return next;
    });
  }, []);

  const collapseAllFilesInPack = useCallback((packId: PackId) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      for (const key of prev) {
        if (key.startsWith(`${packId}:`)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const state: TreeBrowserState = useMemo(
    () => ({
      expandedPacks,
      expandedFiles,
      viewMode,
    }),
    [expandedPacks, expandedFiles, viewMode]
  );

  return {
    state,
    viewMode,
    setViewMode,
    togglePackExpanded,
    toggleFileExpanded,
    isPackExpanded,
    isFileExpanded,
    expandAllPacks,
    collapseAllPacks,
    expandAllFilesInPack,
    collapseAllFilesInPack,
  };
}
