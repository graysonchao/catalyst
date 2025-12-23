import { useState, useCallback } from "react";
import * as api from "../services/api";
import type {
  PackId,
  PackInfo,
  EntityTree,
  PackLoadResult,
} from "../types";

export interface LoadedPack extends PackInfo {
  entityTree: EntityTree;
  enabled: boolean;
}

export interface WorkspaceHook {
  packs: Map<PackId, LoadedPack>;
  loadOrder: PackId[];
  enabledPacks: Set<PackId>;
  loading: boolean;
  error: string | null;
  loadPack: (path: string, readOnly: boolean, nameOverride?: string, enabled?: boolean, excludeDirs?: string[], isBaseGame?: boolean) => Promise<PackLoadResult>;
  closePack: (packId: PackId, force?: boolean) => Promise<void>;
  reloadPack: (packId: PackId) => Promise<void>;
  setPackEnabled: (packId: PackId, enabled: boolean) => void;
  clearError: () => void;
}

export function useWorkspace(): WorkspaceHook {
  const [packs, setPacks] = useState<Map<PackId, LoadedPack>>(new Map());
  const [loadOrder, setLoadOrder] = useState<PackId[]>([]);
  const [enabledPacks, setEnabledPacks] = useState<Set<PackId>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPack = useCallback(
    async (path: string, readOnly: boolean, nameOverride?: string, enabled: boolean = true, excludeDirs?: string[], isBaseGame?: boolean): Promise<PackLoadResult> => {
      setLoading(true);
      setError(null);

      try {
        const result = await api.loadContentPack(path, readOnly, nameOverride, excludeDirs, isBaseGame);

        setPacks((prev) => {
          const next = new Map(prev);
          next.set(result.packId, {
            id: result.packId,
            name: result.name,
            path,
            readOnly,
            entityCount: result.loadStats.entitiesLoaded,
            hasDirtyFiles: false,
            entityTree: result.entityTree,
            enabled,
          });
          return next;
        });

        setLoadOrder((prev) => [...prev, result.packId]);

        if (enabled) {
          setEnabledPacks((prev) => new Set([...prev, result.packId]));
        }

        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const setPackEnabled = useCallback((packId: PackId, enabled: boolean) => {
    setPacks((prev) => {
      const pack = prev.get(packId);
      if (!pack) return prev;
      const next = new Map(prev);
      next.set(packId, { ...pack, enabled });
      return next;
    });

    setEnabledPacks((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(packId);
      } else {
        next.delete(packId);
      }
      return next;
    });
  }, []);

  const closePack = useCallback(
    async (packId: PackId, force: boolean = false): Promise<void> => {
      try {
        await api.closePack(packId, force);

        setPacks((prev) => {
          const next = new Map(prev);
          next.delete(packId);
          return next;
        });

        setLoadOrder((prev) => prev.filter((id) => id !== packId));
        setEnabledPacks((prev) => {
          const next = new Set(prev);
          next.delete(packId);
          return next;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      }
    },
    []
  );

  const reloadPack = useCallback(async (packId: PackId): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.reloadPack(packId);

      setPacks((prev) => {
        const next = new Map(prev);
        const existing = prev.get(packId);
        if (existing) {
          next.set(packId, {
            ...existing,
            entityCount: result.loadStats.entitiesLoaded,
            hasDirtyFiles: false,
            entityTree: result.entityTree,
          });
        }
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    packs,
    loadOrder,
    enabledPacks,
    loading,
    error,
    loadPack,
    closePack,
    reloadPack,
    setPackEnabled,
    clearError,
  };
}
