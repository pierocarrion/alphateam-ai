"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { Mira } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { LanguageToggle } from "@/i18n/LanguageToggle";
import { t } from "@/i18n/messages";

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: "▣" },
  { href: "/admin/users", labelKey: "admin.nav.users", icon: "◉" },
  { href: "/admin/workspaces", labelKey: "admin.nav.workspaces", icon: "⬡" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [locale] = useLocale();
  return (
    <aside className="hidden w-[248px] flex-none flex-col border-r border-line bg-bg lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Mira size={32} mood="happy" />
        <div className="leading-tight">
          <div className="font-display text-[15px] text-ink">
            {t(locale, "admin.console")}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {t(locale, "admin.superAdmin")}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "mb-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14.5px] font-semibold transition-colors",
              isActive(pathname, item.href)
                ? "bg-accent-soft text-ink"
                : "text-ink-2 hover:bg-white/[0.03]"
            )}
          >
            <span className="w-4 text-center text-ink-3">{item.icon}</span>
            {t(locale, item.labelKey)}
          </Link>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3">
        <div className="truncate text-[13px] font-semibold text-ink-2">
          {userName}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Link
            href="/api/auth/signout?callbackUrl=/login"
            className="text-[12px] text-ink-3 hover:text-ink"
          >
            {t(locale, "admin.logout")}
          </Link>
          <LanguageToggle />
        </div>
      </div>
    </aside>
  );
}
