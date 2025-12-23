import type { ValidationResult } from "../../types";

interface ValidationDisplayProps {
  validation: ValidationResult | null;
}

export function ValidationDisplay({ validation }: ValidationDisplayProps) {
  if (!validation) return null;

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  if (!hasErrors && !hasWarnings) return null;

  return (
    <div className="px-3 py-2 bg-zinc-900 border-t border-zinc-700 max-h-32 overflow-y-auto">
      {/* Errors */}
      {hasErrors && (
        <div className="mb-2">
          {validation.errors.map((error, i) => (
            <div key={i} className="flex items-start gap-2 text-xs mb-1">
              <span className="text-red-400 font-bold">ERROR</span>
              <span className="text-red-300">{error.message}</span>
              {error.path && (
                <span className="text-zinc-500 font-mono">{error.path}</span>
              )}
              {error.line && (
                <span className="text-zinc-500">line {error.line}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div>
          {validation.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2 text-xs mb-1">
              <span className="text-amber-400 font-bold">WARN</span>
              <span className="text-amber-300">{warning.message}</span>
              {warning.path && (
                <span className="text-zinc-500 font-mono">{warning.path}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
