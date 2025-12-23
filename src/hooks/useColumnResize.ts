import { useState, useCallback, useRef } from "react";

export function useColumnResize<K extends string>(defaultWidths: Record<K, number>) {
  const [columnWidths, setColumnWidths] = useState(defaultWidths);
  const resizingRef = useRef<{ key: K; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((key: K, minWidth: number, e: React.MouseEvent) => {
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

  return { columnWidths, handleResizeStart };
}

export function usePanelResize(defaultHeight: number, minHeight = 100, maxHeight = 500) {
  const [height, setHeight] = useState(defaultHeight);
  const resizingRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      startY: e.clientY,
      startHeight: height,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = resizingRef.current.startY - e.clientY;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, resizingRef.current.startHeight + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [height, minHeight, maxHeight]);

  return { height, handleResizeStart };
}
