import { useState, useCallback, useRef, ReactNode } from "react";

export interface ColumnDef<T> {
  key: string;
  label: string;
  width: number;
  minWidth?: number;
  render: (item: T, isSelected: boolean) => ReactNode;
  sortable?: boolean;
}

export interface ResizableTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowKey: (item: T) => string;
  selectedKey: string | null;
  onSelectRow: (item: T) => void;
  onDoubleClickRow?: (item: T) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  rowHeight?: number;
  className?: string;
}

export function ResizableTable<T>({
  columns: initialColumns,
  data,
  getRowKey,
  selectedKey,
  onSelectRow,
  onDoubleClickRow,
  sortKey,
  sortDir,
  onSort,
  rowHeight = 18,
  className = "",
}: ResizableTableProps<T>) {
  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    for (const col of initialColumns) {
      widths[col.key] = col.width;
    }
    return widths;
  });

  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Handle column resize
  const handleResizeStart = useCallback((key: string, minWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    resizingRef.current = {
      key,
      startX: e.clientX,
      startWidth: columnWidths[key],
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientX - resizingRef.current.startX;
      const newWidth = Math.max(minWidth, resizingRef.current.startWidth + delta);
      setColumnWidths(prev => ({
        ...prev,
        [resizingRef.current!.key]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [columnWidths]);

  return (
    <div className={`flex-1 overflow-auto ${className}`}>
      <table className="text-xs" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 bg-zinc-800 z-10">
          <tr className="text-zinc-500 border-b border-zinc-700">
            {initialColumns.map((col, idx) => (
              <th
                key={col.key}
                className="px-1 py-1 text-left relative select-none"
                style={{ width: columnWidths[col.key] }}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                <span className={`flex items-center gap-1 ${col.sortable && onSort ? "cursor-pointer hover:text-zinc-200" : ""}`}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-blue-400">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
                {/* Resize handle - not on last column */}
                {idx < initialColumns.length - 1 && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 z-10"
                    onMouseDown={(e) => handleResizeStart(col.key, col.minWidth ?? 30, e)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const key = getRowKey(item);
            const isSelected = key === selectedKey;
            return (
              <tr
                key={key}
                onClick={() => onSelectRow(item)}
                onDoubleClick={onDoubleClickRow ? () => onDoubleClickRow(item) : undefined}
                className={`cursor-pointer border-b border-zinc-700/50 ${
                  isSelected ? "bg-blue-900/30" : "hover:bg-zinc-700/30"
                }`}
                style={{ height: rowHeight }}
              >
                {initialColumns.map((col) => (
                  <td
                    key={col.key}
                    className="px-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ lineHeight: 1, padding: "2px 4px", maxWidth: columnWidths[col.key] }}
                  >
                    {col.render(item, isSelected)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
