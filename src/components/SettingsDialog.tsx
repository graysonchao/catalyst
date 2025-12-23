import { useState, useEffect } from "react";
import type { AppSettings, GamePathInfo } from "../services/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onSelectGamePath: () => Promise<GamePathInfo | null>;
}

export function SettingsDialog({ open, onClose, settings, onSelectGamePath }: SettingsDialogProps) {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValidationMessage(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSelectGamePath = async () => {
    setValidationMessage(null);
    const result = await onSelectGamePath();
    if (result) {
      if (result.valid) {
        setValidationMessage(`Valid ${result.pathType} detected`);
      } else {
        setValidationMessage(`Invalid: ${result.dataPath}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-medium text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Game Path */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Cataclysm-BN Directory
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              Select your game installation, repository checkout, or .app bundle
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={settings?.gamePath || ""}
                placeholder="No directory selected"
                className="flex-1 px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm"
              />
              <button
                onClick={handleSelectGamePath}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded"
              >
                Browse...
              </button>
            </div>
            {validationMessage && (
              <p className={`text-xs mt-1 ${
                validationMessage.startsWith("Valid") ? "text-green-400" : "text-red-400"
              }`}>
                {validationMessage}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
