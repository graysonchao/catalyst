import type { ReactNode } from "react";

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-[280px] h-full bg-zinc-900 border-r border-zinc-700 flex flex-col">
      {children}
    </aside>
  );
}
