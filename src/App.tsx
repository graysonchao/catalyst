import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

import { Sidebar } from "./components/layout/Sidebar";
import { EditorPanel } from "./components/layout/EditorPanel";
import { PackList } from "./components/sidebar/PackList";
import { EntityEditor } from "./components/editor/EntityEditor";
import { EditorTabs } from "./components/editor/EditorTabs";
import { SettingsDialog } from "./components/SettingsDialog";
import { MapEditor } from "./components/map-editor/MapEditor";
import { EntityBrowser } from "./components/browser/EntityBrowser";
import { PackManager } from "./components/packs/PackManager";

import { useWorkspace } from "./hooks/useWorkspace";
import { useEditorTabs } from "./hooks/useEditorTabs";
import { useSettings } from "./hooks/useSettings";
import { openPackDialog, listModsInDirectory } from "./services/api";

import type { PackId, EntityKey } from "./types";

type AppMode = "packs" | "browser" | "editor" | "maps";

function App() {
  const [mode, setMode] = useState<AppMode>("browser");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoLoadedGamePath = useRef<string | null>(null);

  const workspace = useWorkspace();
  const editorTabs = useEditorTabs();
  const { settings, gamePathInfo, selectAndValidateGamePath, addModDirectory, removeModDirectory } = useSettings();

  // Compute the game's mods path
  const gameModsPath = gamePathInfo?.isBnRoot && gamePathInfo.dataPath
    ? `${gamePathInfo.dataPath}/data/mods`
    : null;

  // Track which mod directories we've loaded
  const loadedModDirs = useRef<Set<string>>(new Set());

  // Auto-load game data as "Bright Nights" pack when BN root directory is selected
  useEffect(() => {
    if (!gamePathInfo?.isBnRoot || !gamePathInfo.dataPath || workspace.loading) {
      return;
    }

    // Skip if we've already auto-loaded for this game path
    if (autoLoadedGamePath.current === gamePathInfo.dataPath) {
      return;
    }

    const dataDir = `${gamePathInfo.dataPath}/data`;

    // Mark as loading to prevent duplicate loads
    autoLoadedGamePath.current = gamePathInfo.dataPath;

    // Load base game first (with isBaseGame=true to get metadata from mods/bn/modinfo.json)
    workspace
      .loadPack(dataDir, true, "Bright Nights", true, ["mods"], true)
      .catch((e) => {
        console.error("Failed to auto-load game data:", e);
        autoLoadedGamePath.current = null;
      });
  }, [gamePathInfo, workspace.loading, workspace.loadPack]);

  // Auto-load mods from all mod directories (game mods + user directories)
  useEffect(() => {
    if (workspace.loading || !autoLoadedGamePath.current) {
      return;
    }

    const allModDirs: string[] = [];

    // Add game mods directory if valid
    if (gameModsPath) {
      allModDirs.push(gameModsPath);
    }

    // Add user-configured mod directories
    if (settings?.modDirectories) {
      allModDirs.push(...settings.modDirectories);
    }

    // Load mods from each directory that hasn't been loaded yet
    const loadModsFromDirs = async () => {
      for (const dir of allModDirs) {
        if (loadedModDirs.current.has(dir)) {
          continue;
        }

        loadedModDirs.current.add(dir);

        try {
          const mods = await listModsInDirectory(dir);
          for (const mod of mods) {
            try {
              await workspace.loadPack(mod.path, true, undefined, false);
            } catch (e) {
              console.error(`Failed to auto-load mod ${mod.metadata.modId}:`, e);
            }
          }
        } catch (e) {
          console.error(`Failed to list mods in ${dir}:`, e);
          // Remove from loaded set so it can be retried
          loadedModDirs.current.delete(dir);
        }
      }
    };

    loadModsFromDirs();
  }, [gameModsPath, settings?.modDirectories, workspace.loading, workspace.loadPack]);

  const handleSelectEntity = useCallback(
    (packId: PackId, entityKey: EntityKey) => {
      const [, entityId] = entityKey.split(":");
      editorTabs.openTab(packId, entityKey, entityId || entityKey);
      // Switch to editor mode when selecting an entity
      setMode("editor");
    },
    [editorTabs]
  );

  const handleLoadPack = useCallback(async () => {
    const path = await openPackDialog();
    if (path) {
      try {
        await workspace.loadPack(path, false);
      } catch (e) {
        console.error("Failed to load pack:", e);
      }
    }
  }, [workspace]);

  const handleClosePack = useCallback(
    async (packId: PackId) => {
      try {
        await workspace.closePack(packId);
        editorTabs.tabs
          .filter((tab) => tab.packId === packId)
          .forEach((tab) => editorTabs.closeTab(tab.id));
      } catch (e) {
        console.error("Failed to close pack:", e);
      }
    },
    [workspace, editorTabs]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = editorTabs.tabs.find((t) => t.id === tabId);
      if (tab?.isDirty) {
        if (!confirm("Discard unsaved changes?")) {
          return;
        }
      }
      editorTabs.closeTab(tabId);
    },
    [editorTabs]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editorTabs.activeTabState?.tab.isDirty) {
          editorTabs.saveEntity().then((result) => {
            if (result?.accepted) {
              editorTabs.saveToDisk();
            }
          });
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (editorTabs.activeTabId) {
          handleCloseTab(editorTabs.activeTabId);
        }
      }

      // Comma for settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorTabs, handleCloseTab]);

  const selectedPackId = editorTabs.activeTabState?.tab.packId ?? null;
  const selectedEntityKey = editorTabs.activeTabState?.tab.entityKey ?? null;

  return (
    <div className="flex flex-col h-full bg-zinc-800 text-zinc-100">
      {/* App Header with mode toggle */}
      <header className="relative z-20 flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("packs")}
            className={`px-3 py-1 text-sm rounded ${
              mode === "packs"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Packs
          </button>
          <button
            onClick={() => setMode("browser")}
            className={`px-3 py-1 text-sm rounded ${
              mode === "browser"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Entity Browser
          </button>
          <button
            onClick={() => setMode("editor")}
            className={`px-3 py-1 text-sm rounded ${
              mode === "editor"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Entity Editor
          </button>
          <button
            onClick={() => setMode("maps")}
            className={`px-3 py-1 text-sm rounded ${
              mode === "maps"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Map Editor
          </button>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="px-3 py-1 text-sm bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded"
          title="Settings (Cmd+,)"
        >
          Settings
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {mode === "packs" ? (
          <PackManager
            packs={workspace.packs}
            loadOrder={workspace.loadOrder}
            enabledPacks={workspace.enabledPacks}
            modDirectories={settings?.modDirectories ?? []}
            gameModsPath={gameModsPath}
            onSetPackEnabled={workspace.setPackEnabled}
            onClosePack={handleClosePack}
            onAddModDirectory={addModDirectory}
            onRemoveModDirectory={removeModDirectory}
          />
        ) : mode === "browser" ? (
          <EntityBrowser
            packs={workspace.packs}
            loadOrder={workspace.loadOrder}
            enabledPacks={workspace.enabledPacks}
            onSelectEntity={handleSelectEntity}
            onLoadPack={handleLoadPack}
          />
        ) : mode === "editor" ? (
          <>
            <Sidebar>
              <PackList
                packs={workspace.packs}
                loadOrder={workspace.loadOrder}
                enabledPacks={workspace.enabledPacks}
                selectedPackId={selectedPackId}
                selectedEntityKey={selectedEntityKey}
                onSelectEntity={handleSelectEntity}
                onLoadPack={handleLoadPack}
                onClosePack={handleClosePack}
              />
            </Sidebar>
            <EditorPanel>
              <EditorTabs
                tabs={editorTabs.tabs}
                activeTabId={editorTabs.activeTabId}
                onSelectTab={editorTabs.selectTab}
                onCloseTab={handleCloseTab}
              />
              <TabContent editorTabs={editorTabs} />
            </EditorPanel>
          </>
        ) : (
          <MapEditor
            packs={workspace.packs}
            loadOrder={workspace.loadOrder}
            enabledPacks={workspace.enabledPacks}
            gamePath={settings?.gamePath ?? null}
          />
        )}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSelectGamePath={selectAndValidateGamePath}
      />

      {/* Error toast */}
      {workspace.error && (
        <div className="fixed bottom-4 right-4 bg-red-900 text-red-100 px-4 py-2 rounded shadow-lg">
          <div className="flex items-center gap-2">
            <span>{workspace.error}</span>
            <button onClick={workspace.clearError} className="text-red-300 hover:text-white">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {workspace.loading && (
        <div className="fixed top-12 right-4 bg-blue-900 text-blue-100 px-3 py-1 rounded text-sm">
          Loading...
        </div>
      )}
    </div>
  );
}

function TabContent({ editorTabs }: { editorTabs: ReturnType<typeof useEditorTabs> }) {
  const state = editorTabs.activeTabState;

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Select an entity to edit
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400">
        Error: {state.error}
      </div>
    );
  }

  if (!state.entity) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        No entity data
      </div>
    );
  }

  const entityHook = {
    entity: state.entity,
    loading: state.loading,
    error: state.error,
    editorContent: state.editorContent,
    validation: state.validation,
    isDirty: state.tab.isDirty,
    setEditorContent: editorTabs.setEditorContent,
    saveEntity: editorTabs.saveEntity,
    revertChanges: editorTabs.revertChanges,
  };

  return (
    <EntityEditor
      entityHook={entityHook}
      onSaveToDisk={editorTabs.saveToDisk}
    />
  );
}

export default App;
