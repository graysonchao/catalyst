import { useState, useEffect, useCallback } from "react";
import {
  getSettings,
  saveSettings,
  validateGamePath,
  selectGameDirectory,
  selectModDirectory,
  type AppSettings,
  type GamePathInfo,
} from "../services/settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [gamePathInfo, setGamePathInfo] = useState<GamePathInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount and validate game path if set
  useEffect(() => {
    getSettings()
      .then(async (s) => {
        setSettings(s);
        // Validate existing game path to get isBnRoot info
        if (s.gamePath) {
          try {
            const info = await validateGamePath(s.gamePath);
            setGamePathInfo(info);
          } catch {
            // Path no longer valid, clear it
            setGamePathInfo(null);
          }
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...newSettings };
    try {
      await saveSettings(updated);
      setSettings(updated);
    } catch (e) {
      setError(String(e));
    }
  }, [settings]);

  const selectAndValidateGamePath = useCallback(async (): Promise<GamePathInfo | null> => {
    const path = await selectGameDirectory();
    if (!path) return null;

    try {
      const info = await validateGamePath(path);
      if (info.valid) {
        await updateSettings({ gamePath: path });
        setGamePathInfo(info);
      }
      return info;
    } catch (e) {
      return {
        valid: false,
        pathType: "error",
        dataPath: String(e),
        isBnRoot: false,
      };
    }
  }, [updateSettings]);

  const addModDirectory = useCallback(async (): Promise<string | null> => {
    const path = await selectModDirectory();
    if (!path || !settings) return null;

    // Don't add duplicates
    if (settings.modDirectories.includes(path)) return null;

    const updated = {
      ...settings,
      modDirectories: [...settings.modDirectories, path],
    };
    try {
      await saveSettings(updated);
      setSettings(updated);
      return path;
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [settings]);

  const removeModDirectory = useCallback(async (path: string) => {
    if (!settings) return;

    const updated = {
      ...settings,
      modDirectories: settings.modDirectories.filter((p) => p !== path),
    };
    try {
      await saveSettings(updated);
      setSettings(updated);
    } catch (e) {
      setError(String(e));
    }
  }, [settings]);

  return {
    settings,
    gamePathInfo,
    loading,
    error,
    updateSettings,
    selectAndValidateGamePath,
    addModDirectory,
    removeModDirectory,
  };
}
