import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  PackId,
  EntityKey,
  PackLoadResult,
  WorkspaceState,
  EntityData,
  UpdateResult,
  SearchResult,
  SaveResult,
  AvailableModInfo,
} from "../types";

// Workspace commands

export async function loadContentPack(
  path: string,
  readOnly: boolean,
  nameOverride?: string,
  excludeDirs?: string[],
  isBaseGame?: boolean
): Promise<PackLoadResult> {
  return invoke("load_content_pack", { path, readOnly, nameOverride, excludeDirs, isBaseGame });
}

export async function getWorkspaceState(): Promise<WorkspaceState> {
  return invoke("get_workspace_state");
}

export async function closePack(
  packId: PackId,
  force: boolean = false
): Promise<void> {
  return invoke("close_pack", { packId, force });
}

export async function reloadPack(packId: PackId): Promise<PackLoadResult> {
  return invoke("reload_pack", { packId });
}

export async function listAvailableMods(gamePath: string): Promise<AvailableModInfo[]> {
  return invoke("list_available_mods", { gamePath });
}

export async function listModsInDirectory(dirPath: string): Promise<AvailableModInfo[]> {
  return invoke("list_mods_in_directory", { dirPath });
}

// Entity commands

export async function getEntity(
  packId: PackId,
  entityKey: EntityKey
): Promise<EntityData> {
  return invoke("get_entity", { packId, entityKey });
}

export async function updateEntity(
  packId: PackId,
  entityKey: EntityKey,
  newJsonText: string
): Promise<UpdateResult> {
  return invoke("update_entity", { packId, entityKey, newJsonText });
}

export async function searchEntities(
  query: string,
  entityTypes?: string[],
  packIds?: PackId[]
): Promise<SearchResult[]> {
  return invoke("search_entities", { query, entityTypes, packIds });
}

// File commands

export async function savePack(packId: PackId): Promise<SaveResult> {
  return invoke("save_pack", { packId });
}

// Dialog helpers

export async function openPackDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Content Pack Folder",
  });
  return selected as string | null;
}
