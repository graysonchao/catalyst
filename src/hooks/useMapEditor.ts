import { useState, useCallback, useRef } from "react";
import type { ResolvedSymbol, MapTool, PaletteData, EntityData } from "../types";
import { parseMapgenRows, resolveSymbolMappings, updateGridCell, gridToRows, MapgenJson } from "../services/mapgen";
import { loadPalette } from "../services/terrain";

const MAX_HISTORY = 50;

interface UseMapEditorResult {
  // Grid state
  grid: string[][];
  palette: ResolvedSymbol[];

  // Selection state
  selectedSymbol: string | null;
  tool: MapTool;

  // Status
  isDirty: boolean;
  loading: boolean;
  error: string | null;

  // History
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  loadEntity: (entity: EntityData, gamePath: string) => Promise<void>;
  selectSymbol: (symbol: string) => void;
  setTool: (tool: MapTool) => void;
  updateCell: (row: number, col: number, symbol: string) => void;
  updateCells: (cells: Array<{ row: number; col: number; symbol: string }>) => void;
  updateSymbolMapping: (
    oldSymbol: string,
    newSymbol: string,
    terrain: string | null,
    furniture: string | null
  ) => void;
  addSymbol: (symbol: string, terrain: string | null, furniture: string | null) => void;
  getModifiedJson: () => string | null;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export function useMapEditor(): UseMapEditorResult {
  const [grid, setGrid] = useState<string[][]>([]);
  const [palette, setPalette] = useState<ResolvedSymbol[]>([]);
  const [originalJson, setOriginalJson] = useState<MapgenJson | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [tool, setTool] = useState<MapTool>("paint");
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo/Redo history
  const historyRef = useRef<string[][][]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((newGrid: string[][]) => {
    // Remove any redo states
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new state
    historyRef.current.push(newGrid.map(row => [...row]));

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevGrid = historyRef.current[historyIndexRef.current];
      setGrid(prevGrid.map(row => [...row]));
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextGrid = historyRef.current[historyIndexRef.current];
      setGrid(nextGrid.map(row => [...row]));
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, []);

  const loadEntity = useCallback(async (entity: EntityData, gamePath: string) => {
    setLoading(true);
    setError(null);

    try {
      const json = JSON.parse(entity.jsonText) as MapgenJson;
      setOriginalJson(json);

      // Parse the grid
      const parsedGrid = parseMapgenRows(json);
      if (!parsedGrid) {
        throw new Error("Failed to parse mapgen rows");
      }
      setGrid(parsedGrid);

      // Initialize history with initial state
      historyRef.current = [parsedGrid.map(row => [...row])];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);

      // Load external palettes
      const paletteIds = json.object?.palettes ?? [];
      const externalPalettes = new Map<string, PaletteData>();

      for (const paletteId of paletteIds) {
        try {
          const paletteData = await loadPalette(gamePath, paletteId);
          externalPalettes.set(paletteId, paletteData);
        } catch (e) {
          console.warn(`Failed to load palette ${paletteId}:`, e);
        }
      }

      // Resolve symbol mappings
      const resolved = resolveSymbolMappings(json, externalPalettes);
      setPalette(resolved);

      // Select first symbol by default
      if (resolved.length > 0) {
        setSelectedSymbol(resolved[0].symbol);
      }

      setIsDirty(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const selectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  const updateCell = useCallback((row: number, col: number, symbol: string) => {
    setGrid((prev) => {
      const newGrid = updateGridCell(prev, row, col, symbol);
      if (newGrid !== prev) {
        pushHistory(newGrid);
        setIsDirty(true);
      }
      return newGrid;
    });
  }, [pushHistory]);

  const updateCells = useCallback(
    (cells: Array<{ row: number; col: number; symbol: string }>) => {
      setGrid((prev) => {
        let newGrid = prev;
        for (const { row, col, symbol } of cells) {
          newGrid = updateGridCell(newGrid, row, col, symbol);
        }
        if (newGrid !== prev) {
          pushHistory(newGrid);
          setIsDirty(true);
        }
        return newGrid;
      });
    },
    [pushHistory]
  );

  const updateSymbolMapping = useCallback(
    (
      oldSymbol: string,
      newSymbol: string,
      terrain: string | null,
      furniture: string | null
    ) => {
      setPalette((prev) => {
        const newPalette = prev.map((item) => {
          if (item.symbol === oldSymbol) {
            return {
              ...item,
              symbol: newSymbol,
              terrain,
              furniture,
              source: { type: "inline" as const },
            };
          }
          return item;
        });
        return newPalette;
      });

      // If symbol changed, update grid too
      if (oldSymbol !== newSymbol) {
        setGrid((prev) =>
          prev.map((row) =>
            row.map((cell) => (cell === oldSymbol ? newSymbol : cell))
          )
        );
      }

      setIsDirty(true);
    },
    []
  );

  const addSymbol = useCallback(
    (symbol: string, terrain: string | null, furniture: string | null) => {
      setPalette((prev) => {
        // Check if symbol already exists
        if (prev.some((p) => p.symbol === symbol)) {
          return prev;
        }

        const newPalette = [
          ...prev,
          {
            symbol,
            terrain,
            furniture,
            source: { type: "inline" as const },
          },
        ];
        newPalette.sort((a, b) => a.symbol.localeCompare(b.symbol));
        return newPalette;
      });
      setSelectedSymbol(symbol);
      setIsDirty(true);
    },
    []
  );

  const getModifiedJson = useCallback((): string | null => {
    if (!originalJson) return null;

    const modified = { ...originalJson };
    if (!modified.object) {
      modified.object = {};
    }

    // Update rows
    modified.object.rows = gridToRows(grid);

    // Update inline terrain/furniture from palette
    const inlineTerrain: Record<string, string> = {};
    const inlineFurniture: Record<string, string> = {};

    for (const item of palette) {
      if (item.source.type === "inline") {
        if (item.terrain) {
          inlineTerrain[item.symbol] = item.terrain;
        }
        if (item.furniture) {
          inlineFurniture[item.symbol] = item.furniture;
        }
      }
    }

    if (Object.keys(inlineTerrain).length > 0) {
      modified.object.terrain = inlineTerrain;
    }
    if (Object.keys(inlineFurniture).length > 0) {
      modified.object.furniture = inlineFurniture;
    }

    return JSON.stringify(modified, null, 2);
  }, [originalJson, grid, palette]);

  const reset = useCallback(() => {
    setGrid([]);
    setPalette([]);
    setOriginalJson(null);
    setSelectedSymbol(null);
    setTool("paint");
    setIsDirty(false);
    setLoading(false);
    setError(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    grid,
    palette,
    selectedSymbol,
    tool,
    isDirty,
    loading,
    error,
    canUndo,
    canRedo,
    loadEntity,
    selectSymbol,
    setTool,
    updateCell,
    updateCells,
    updateSymbolMapping,
    addSymbol,
    getModifiedJson,
    undo,
    redo,
    reset,
  };
}
