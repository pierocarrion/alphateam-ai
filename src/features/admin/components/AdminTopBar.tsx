"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Usuarios",
  "/admin/workspaces": "Workspaces",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/admin/users")) return "Usuarios";
  if (pathname.startsWith("/admin/workspaces")) return "Workspaces";
  return "Admin";
}

export function AdminTopBar() {
  const pathname = usePathname();
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-bg px-5">
      <h1 className="font-display text-[17px] text-ink">{titleFor(pathname)}</h1>
      <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
        Super Admin
      </span>
    </header>
  );
}
