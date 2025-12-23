import { useState, useCallback } from "react";
import { LoadedTileset, loadTileset } from "../services/tileset";

interface UseTilesetResult {
  tileset: LoadedTileset | null;
  loading: boolean;
  error: string | null;
  load: (gamePath: string, tilesetName: string) => Promise<void>;
  clear: () => void;
}

export function useTileset(): UseTilesetResult {
  const [tileset, setTileset] = useState<LoadedTileset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (gamePath: string, tilesetName: string) => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await loadTileset(gamePath, tilesetName);
      setTileset(loaded);
    } catch (e) {
      setError(String(e));
      setTileset(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setTileset(null);
    setError(null);
  }, []);

  return { tileset, loading, error, load, clear };
}
