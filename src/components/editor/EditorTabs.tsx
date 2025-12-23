import type { EntityKey, PackId } from "../../types";

export interface EditorTab {
  id: string; // unique tab id
  packId: PackId;
  entityKey: EntityKey;
  label: string;
  isDirty: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

export function EditorTabs({ tabs, activeTabId, onSelectTab, onCloseTab }: EditorTabsProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex bg-zinc-900 border-b border-zinc-700 overflow-x-auto">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => onSelectTab(tab.id)}
          onClose={() => onCloseTab(tab.id)}
        />
      ))}
    </div>
  );
}

interface TabProps {
  tab: EditorTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer
        border-r border-zinc-700 min-w-0 max-w-[180px]
        ${isActive
          ? "bg-zinc-800 text-zinc-100"
          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
        }
      `}
    >
      {/* Dirty indicator */}
      {tab.isDirty && (
        <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
      )}

      {/* Label */}
      <span className="truncate flex-1">{tab.label}</span>

      {/* Close button */}
      <button
        onClick={handleClose}
        className={`
          flex-shrink-0 w-4 h-4 rounded flex items-center justify-center
          text-zinc-500 hover:text-zinc-200 hover:bg-zinc-600
          ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
      >
        ×
      </button>
    </div>
  );
}
