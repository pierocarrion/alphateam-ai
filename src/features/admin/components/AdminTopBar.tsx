"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

function titleKeyFor(pathname: string): string {
  if (pathname === "/admin") return "admin.title.dashboard";
  if (pathname.startsWith("/admin/users")) return "admin.title.users";
  if (pathname.startsWith("/admin/workspaces")) return "admin.title.workspaces";
  return "admin.title.admin";
}

export function AdminTopBar() {
  const pathname = usePathname();
  const [locale] = useLocale();
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-bg px-5">
      <h1 className="font-display text-[17px] text-ink">
        {t(locale, titleKeyFor(pathname))}
      </h1>
      <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
        {t(locale, "admin.superAdmin")}
      </span>
    </header>
  );
}
