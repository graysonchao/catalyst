import { useRef, useEffect, useCallback, useState } from "react";
import type { ResolvedSymbol, MapTool, TerrainInfo } from "../../types";
import { LoadedTileset, renderTile, getColor } from "../../services/tileset";

interface MapGridProps {
  grid: string[][];
  palette: ResolvedSymbol[];
  terrainLookup: Map<string, TerrainInfo>;
  tileset: LoadedTileset | null;
  selectedSymbol: string | null;
  tool: MapTool;
  onCellChange: (row: number, col: number, symbol: string) => void;
  onCellsChange: (cells: Array<{ row: number; col: number; symbol: string }>) => void;
}

const CELL_SIZE = 24;

export function MapGrid({
  grid,
  palette,
  terrainLookup,
  tileset,
  selectedSymbol,
  tool,
  onCellChange,
  onCellsChange,
}: MapGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [toolStart, setToolStart] = useState<{ row: number; col: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ row: number; col: number } | null>(null);

  // Create a map for quick symbol lookup
  const symbolMap = new Map<string, ResolvedSymbol>();
  for (const sym of palette) {
    symbolMap.set(sym.symbol, sym);
  }

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const width = cols * CELL_SIZE;
  const height = rows * CELL_SIZE;

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
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;

        if (tileset) {
          // Tileset rendering
          renderTile(
            ctx,
            tileset,
            resolved?.terrain ?? null,
            resolved?.furniture ?? null,
            x,
            y,
            CELL_SIZE
          );
        } else {
          // ASCII rendering - show the mapgen symbol with terrain color
          const terrainId = resolved?.terrain;
          const terrain = terrainId ? terrainLookup.get(terrainId) : null;
          // Use the mapgen symbol (single char), not terrain's display symbol
          const displaySymbol = symbol;
          const color = terrain?.color ? getColor(terrain.color) : "#ffffff";

          ctx.fillStyle = "#222";
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

          ctx.fillStyle = color;
          ctx.font = "16px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(displaySymbol, x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * CELL_SIZE);
      ctx.lineTo(width, row * CELL_SIZE);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * CELL_SIZE, 0);
      ctx.lineTo(col * CELL_SIZE, height);
      ctx.stroke();
    }

    // Draw OMT boundaries (every 24 cells)
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    for (let row = 0; row <= rows; row += 24) {
      ctx.beginPath();
      ctx.moveTo(0, row * CELL_SIZE);
      ctx.lineTo(width, row * CELL_SIZE);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col += 24) {
      ctx.beginPath();
      ctx.moveTo(col * CELL_SIZE, 0);
      ctx.lineTo(col * CELL_SIZE, height);
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
            cell.col * CELL_SIZE + 1,
            cell.row * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
          );
        }
      } else if (tool === "box") {
        const minRow = Math.min(toolStart.row, hoverPos.row);
        const maxRow = Math.max(toolStart.row, hoverPos.row);
        const minCol = Math.min(toolStart.col, hoverPos.col);
        const maxCol = Math.max(toolStart.col, hoverPos.col);
        ctx.strokeRect(
          minCol * CELL_SIZE,
          minRow * CELL_SIZE,
          (maxCol - minCol + 1) * CELL_SIZE,
          (maxRow - minRow + 1) * CELL_SIZE
        );
      }
    }

    // Draw hover highlight
    if (hoverPos && !toolStart) {
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoverPos.col * CELL_SIZE + 1,
        hoverPos.row * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );
    }
  }, [grid, palette, terrainLookup, tileset, toolStart, hoverPos, tool, rows, cols, width, height, symbolMap]);

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.floor(x / CELL_SIZE);
      const row = Math.floor(y / CELL_SIZE);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        return { row, col };
      }
      return null;
    },
    [rows, cols]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      if (!cell || !selectedSymbol) return;

      if (tool === "paint") {
        setIsPainting(true);
        onCellChange(cell.row, cell.col, selectedSymbol);
      } else if (tool === "line" || tool === "box") {
        if (!toolStart) {
          setToolStart(cell);
        } else {
          // Complete the tool action
          const cells = tool === "line"
            ? getLineCells(toolStart.row, toolStart.col, cell.row, cell.col)
            : getBoxCells(toolStart.row, toolStart.col, cell.row, cell.col);

          onCellsChange(cells.map((c) => ({ ...c, symbol: selectedSymbol })));
          setToolStart(null);
        }
      }
    },
    [getCellFromEvent, selectedSymbol, tool, toolStart, onCellChange, onCellsChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      setHoverPos(cell);

      if (isPainting && cell && selectedSymbol && tool === "paint") {
        onCellChange(cell.row, cell.col, selectedSymbol);
      }
    },
    [getCellFromEvent, isPainting, selectedSymbol, tool, onCellChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPainting(false);
    setHoverPos(null);
  }, []);

  return (
    <div className="overflow-auto flex-1 bg-zinc-900 p-4">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
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
