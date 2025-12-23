import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface AppSettings {
  gamePath: string | null;
  tileset: string | null;
  modDirectories: string[];
}

export interface GamePathInfo {
  valid: boolean;
  pathType: string;
  dataPath: string;
  isBnRoot: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function validateGamePath(path: string): Promise<GamePathInfo> {
  return invoke<GamePathInfo>("validate_game_path", { path });
}

export async function selectGameDirectory(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select Cataclysm-BN Directory",
  });
  return result as string | null;
}

export async function selectModDirectory(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select Mod Directory",
  });
  return result as string | null;
}
