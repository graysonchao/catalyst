import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { ResolvedSymbol, MapTool, TerrainInfo } from "../../types";
import { LoadedTileset, renderTile, getColor } from "../../services/tileset";

interface MapGridProps {
  grid: string[][];
  palette: ResolvedSymbol[];
  terrainLookup: Map<string, TerrainInfo>;
  tileset: LoadedTileset | null;
  selectedSymbol: string | null;
  tool: MapTool;
  boxFilled: boolean;
  onCellChange: (row: number, col: number, symbol: string) => void;
  onCellsChange: (cells: Array<{ row: number; col: number; symbol: string }>) => void;
  onCommitPaintStroke: () => void;
  onToolChange: (tool: MapTool) => void;
  onSelectSymbol: (symbol: string) => void;
  onGetSymbolAt: (row: number, col: number) => string | null;
}

const BASE_CELL_SIZE = 24;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.015; // ~1.5% per scroll

export function MapGrid({
  grid,
  palette,
  terrainLookup,
  tileset,
  selectedSymbol,
  tool,
  boxFilled,
  onCellChange,
  onCellsChange,
  onCommitPaintStroke,
  onToolChange,
  onSelectSymbol,
  onGetSymbolAt,
}: MapGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPainting, setIsPainting] = useState(false);
  const [toolStart, setToolStart] = useState<{ row: number; col: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ row: number; col: number } | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Track if middle mouse or hand tool is active for panning
  const [middleMouseDown, setMiddleMouseDown] = useState(false);

  const cellSize = BASE_CELL_SIZE * zoom;

  // Create a map for quick symbol lookup (memoized to avoid infinite useEffect loop)
  const symbolMap = useMemo(() => {
    const map = new Map<string, ResolvedSymbol>();
    for (const sym of palette) {
      map.set(sym.symbol, sym);
    }
    return map;
  }, [palette]);

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const width = cols * cellSize;
  const height = rows * cellSize;

  // Render the grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Render each cell
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const symbol = grid[row][col];
        const resolved = symbolMap.get(symbol);
        const x = col * cellSize;
        const y = row * cellSize;

        if (tileset) {
          // Tileset rendering
          renderTile(
            ctx,
            tileset,
            resolved?.terrain ?? null,
            resolved?.furniture ?? null,
            x,
            y,
            cellSize
          );
        } else {
          // ASCII rendering - show the mapgen symbol with terrain color
          const terrainId = resolved?.terrain;
          const terrain = terrainId ? terrainLookup.get(terrainId) : null;
          const displaySymbol = symbol;
          const color = terrain?.color ? getColor(terrain.color) : "#ffffff";

          ctx.fillStyle = "#222";
          ctx.fillRect(x, y, cellSize, cellSize);

          ctx.fillStyle = color;
          ctx.font = `${Math.floor(cellSize * 0.67)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(displaySymbol, x + cellSize / 2, y + cellSize / 2);
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellSize);
      ctx.lineTo(width, row * cellSize);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cellSize, 0);
      ctx.lineTo(col * cellSize, height);
      ctx.stroke();
    }

    // Draw OMT boundaries (every 24 cells)
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    for (let row = 0; row <= rows; row += 24) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellSize);
      ctx.lineTo(width, row * cellSize);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col += 24) {
      ctx.beginPath();
      ctx.moveTo(col * cellSize, 0);
      ctx.lineTo(col * cellSize, height);
      ctx.stroke();
    }

    // Draw tool preview
    if (toolStart && hoverPos && (tool === "line" || tool === "box")) {
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 2;

      if (tool === "line") {
        const cells = getLineCells(toolStart.row, toolStart.col, hoverPos.row, hoverPos.col);
        for (const cell of cells) {
          ctx.strokeRect(
            cell.col * cellSize + 1,
            cell.row * cellSize + 1,
            cellSize - 2,
            cellSize - 2
          );
        }
      } else if (tool === "box") {
        const minRow = Math.min(toolStart.row, hoverPos.row);
        const maxRow = Math.max(toolStart.row, hoverPos.row);
        const minCol = Math.min(toolStart.col, hoverPos.col);
        const maxCol = Math.max(toolStart.col, hoverPos.col);

        if (boxFilled) {
          // Filled box preview
          ctx.strokeRect(
            minCol * cellSize,
            minRow * cellSize,
            (maxCol - minCol + 1) * cellSize,
            (maxRow - minRow + 1) * cellSize
          );
        } else {
          // Outline-only preview - draw each perimeter cell
          const cells = getBoxOutlineCells(toolStart.row, toolStart.col, hoverPos.row, hoverPos.col);
          for (const cell of cells) {
            ctx.strokeRect(
              cell.col * cellSize + 1,
              cell.row * cellSize + 1,
              cellSize - 2,
              cellSize - 2
            );
          }
        }
      }
    }

    // Draw hover highlight
    if (hoverPos && !toolStart && tool !== "hand") {
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoverPos.col * cellSize + 1,
        hoverPos.row * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    }
  }, [grid, palette, terrainLookup, tileset, toolStart, hoverPos, tool, boxFilled, rows, cols, width, height, cellSize, symbolMap]);

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        return { row, col };
      }
      return null;
    },
    [rows, cols, cellSize]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Middle mouse button - start panning
      if (e.button === 1) {
        e.preventDefault();
        setMiddleMouseDown(true);
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        return;
      }

      // Option/Alt + click = eyedropper
      if (e.altKey) {
        const cell = getCellFromEvent(e);
        if (cell) {
          const symbol = onGetSymbolAt(cell.row, cell.col);
          if (symbol) {
            onSelectSymbol(symbol);
          }
        }
        return;
      }

      const cell = getCellFromEvent(e);
      if (!cell) return;

      // Hand tool - start panning
      if (tool === "hand") {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        return;
      }

      // Eyedropper tool - pick symbol
      if (tool === "eyedropper") {
        const symbol = onGetSymbolAt(cell.row, cell.col);
        if (symbol) {
          onSelectSymbol(symbol);
          onToolChange("paint"); // Switch back to paint after picking
        }
        return;
      }

      if (!selectedSymbol) return;

      if (tool === "paint") {
        setIsPainting(true);
        onCellChange(cell.row, cell.col, selectedSymbol);
      } else if (tool === "fill") {
        // Flood fill
        const cells = getFloodFillCells(grid, cell.row, cell.col, selectedSymbol);
        if (cells.length > 0) {
          onCellsChange(cells.map((c) => ({ ...c, symbol: selectedSymbol })));
        }
      } else if (tool === "line" || tool === "box") {
        if (!toolStart) {
          setToolStart(cell);
        } else {
          // Complete the tool action
          let cells: Array<{ row: number; col: number }>;
          if (tool === "line") {
            cells = getLineCells(toolStart.row, toolStart.col, cell.row, cell.col);
          } else {
            cells = boxFilled
              ? getBoxCells(toolStart.row, toolStart.col, cell.row, cell.col)
              : getBoxOutlineCells(toolStart.row, toolStart.col, cell.row, cell.col);
          }
          onCellsChange(cells.map((c) => ({ ...c, symbol: selectedSymbol })));
          setToolStart(null);
        }
      }
    },
    [getCellFromEvent, selectedSymbol, tool, boxFilled, toolStart, panOffset, grid, onCellChange, onCellsChange, onGetSymbolAt, onSelectSymbol, onToolChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Panning (hand tool or middle mouse)
      if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

      const cell = getCellFromEvent(e);
      setHoverPos(cell);

      if (isPainting && cell && selectedSymbol && tool === "paint") {
        onCellChange(cell.row, cell.col, selectedSymbol);
      }
    },
    [getCellFromEvent, isPainting, isPanning, panStart, selectedSymbol, tool, onCellChange]
  );

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      setMiddleMouseDown(false);
    }

    if (isPainting) {
      setIsPainting(false);
      onCommitPaintStroke();
    }

    setIsPanning(false);
  }, [isPainting, onCommitPaintStroke]);

  const handleMouseLeave = useCallback(() => {
    if (isPainting) {
      onCommitPaintStroke();
    }
    setIsPainting(false);
    setIsPanning(false);
    setHoverPos(null);
  }, [isPainting, onCommitPaintStroke]);

  // Mouse wheel zoom - continuous
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    setZoom((prev) => {
      const newZoom = e.deltaY < 0 ? prev * ZOOM_STEP : prev / ZOOM_STEP;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          onToolChange("hand");
          break;
        case "q":
          e.preventDefault();
          onToolChange("paint");
          break;
        case "w":
          e.preventDefault();
          onToolChange("line");
          break;
        case "e":
          e.preventDefault();
          onToolChange("box");
          break;
        case "r":
          e.preventDefault();
          onToolChange("fill");
          break;
        case "s":
          e.preventDefault();
          onToolChange("eyedropper");
          break;
        case "1":
          e.preventDefault();
          setZoom(1);
          break;
        case "2":
          e.preventDefault();
          setZoom(2);
          break;
        case "3":
          e.preventDefault();
          setZoom(3);
          break;
        case "4":
          e.preventDefault();
          setZoom(4);
          break;
        case "escape":
          // Cancel current tool action
          setToolStart(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange]);

  // Cursor style
  const getCursor = () => {
    if (isPanning || middleMouseDown || tool === "hand") {
      return isPanning ? "grabbing" : "grab";
    }
    if (tool === "eyedropper") {
      return "crosshair"; // Could use a custom cursor
    }
    return "crosshair";
  };

  return (
    <div
      ref={containerRef}
      className="overflow-auto flex-1 bg-zinc-900 p-4"
      onWheel={handleWheel}
      style={{ cursor: getCursor() }}
    >
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: "0 0",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ cursor: getCursor() }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Zoom indicator */}
      <div className="fixed bottom-4 left-4 bg-zinc-800 px-2 py-1 rounded text-xs text-zinc-400">
        {zoom.toFixed(1)}x zoom (1-4 to set)
      </div>
    </div>
  );
}

// Bresenham's line algorithm
function getLineCells(
  r0: number,
  c0: number,
  r1: number,
  c1: number
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  const dr = Math.abs(r1 - r0);
  const dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1;
  const sc = c0 < c1 ? 1 : -1;
  let err = dr - dc;

  let r = r0;
  let c = c0;

  while (true) {
    cells.push({ row: r, col: c });

    if (r === r1 && c === c1) break;

    const e2 = 2 * err;
    if (e2 > -dc) {
      err -= dc;
      r += sr;
    }
    if (e2 < dr) {
      err += dr;
      c += sc;
    }
  }

  return cells;
}

function getBoxCells(
  r0: number,
  c0: number,
  r1: number,
  c1: number
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  const minRow = Math.min(r0, r1);
  const maxRow = Math.max(r0, r1);
  const minCol = Math.min(c0, c1);
  const maxCol = Math.max(c0, c1);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push({ row, col });
    }
  }

  return cells;
}

function getBoxOutlineCells(
  r0: number,
  c0: number,
  r1: number,
  c1: number
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  const minRow = Math.min(r0, r1);
  const maxRow = Math.max(r0, r1);
  const minCol = Math.min(c0, c1);
  const maxCol = Math.max(c0, c1);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      // Only include perimeter cells
      if (row === minRow || row === maxRow || col === minCol || col === maxCol) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

// Flood fill algorithm
function getFloodFillCells(
  grid: string[][],
  startRow: number,
  startCol: number,
  newSymbol: string
): Array<{ row: number; col: number }> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (startRow < 0 || startRow >= rows || startCol < 0 || startCol >= cols) {
    return [];
  }

  const targetSymbol = grid[startRow][startCol];

  // Don't fill if target is same as new symbol
  if (targetSymbol === newSymbol) {
    return [];
  }

  const cells: Array<{ row: number; col: number }> = [];
  const visited = new Set<string>();
  const queue: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const key = `${row},${col}`;

    if (visited.has(key)) continue;
    if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
    if (grid[row][col] !== targetSymbol) continue;

    visited.add(key);
    cells.push({ row, col });

    // Add neighbors
    queue.push({ row: row - 1, col });
    queue.push({ row: row + 1, col });
    queue.push({ row, col: col - 1 });
    queue.push({ row, col: col + 1 });
  }

  return cells;
}
