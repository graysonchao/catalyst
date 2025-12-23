import type { ReactNode } from "react";

interface EditorPanelProps {
  children: ReactNode;
}

export function EditorPanel({ children }: EditorPanelProps) {
  return (
    <main className="flex-1 h-full bg-zinc-800 flex flex-col overflow-hidden">
      {children}
    </main>
  );
}
