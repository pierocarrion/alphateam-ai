"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, type IconName } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

const items: { icon: IconName; labelKey: string; href: string }[] = [
  { icon: "home", labelKey: "nav.now", href: "/home" },
  { icon: "chat", labelKey: "nav.team", href: "/chat" },
  { icon: "crew", labelKey: "nav.crew", href: "/crew" },
  { icon: "heart", labelKey: "nav.you", href: "/me" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [locale] = useLocale();

  return (
    <nav className="flex flex-none items-stretch justify-around border-t border-line bg-bg-2/80 px-3.5 pb-6 pt-2 backdrop-blur-md">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold transition-colors ${
              active ? "text-ink" : "text-ink-3"
            }`}
          >
            <Icon
              name={item.icon}
              size={23}
              color={active ? "var(--color-ink)" : "currentColor"}
              stroke={active ? 2.3 : 2}
            />
            <span>{t(locale, item.labelKey)}</span>
            <span
              className={`mt-0.5 h-1.5 w-1.5 rounded-full bg-accent transition-opacity ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold text-ink-3 transition-colors hover:text-ink"
        aria-label={t(locale, "nav.logout")}
      >
        <Icon name="logout" size={23} color="currentColor" stroke={2} />
        <span>{t(locale, "nav.logout")}</span>
        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent opacity-0" />
      </button>
    </nav>
  );
}
