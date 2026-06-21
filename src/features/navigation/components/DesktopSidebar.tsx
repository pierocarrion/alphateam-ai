"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/shared/lib/cn";
import { Avatar, Icon, Mira, type PersonId } from "@/shared/ui";

const channels = ["q3-launch", "general", "design"];
const dms: PersonId[] = ["daniel", "sofia", "theo", "priya"];

interface SideRowProps {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}

function SideRow({ href, active, children }: SideRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-0.5 flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[14.5px] font-semibold transition-colors",
        active
          ? "bg-accent-soft text-ink"
          : "text-ink-2 hover:bg-white/[0.03]"
      )}
    >
      {children}
    </Link>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </div>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name || "Maya";
  const userRole = "Coordinator"; // Could come from profile later

  return (
    <aside className="hidden w-[244px] flex-none flex-col border-r border-line bg-bg-2 lg:flex">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-[18px] pb-3.5">
        <Mira size={30} mood="calm" />
        <div>
          <div className="font-display text-base text-ink">AlphaTeam</div>
          <div className="text-[11px] text-ink-3">Acme · workspace</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3.5">
        <SideLabel>Channels</SideLabel>
        {channels.map((c) => (
          <SideRow
            key={c}
            href="/chat"
            active={pathname === "/chat" && c === "q3-launch"}
          >
            <span className="text-ink-3">#</span> {c}
          </SideRow>
        ))}

        <div className="h-3.5" />
        <SideLabel>Direct messages</SideLabel>
        {dms.map((d) => (
          <SideRow key={d} href="/chat">
            <Avatar who={d} size={20} /> {d.charAt(0).toUpperCase() + d.slice(1)}
          </SideRow>
        ))}

        <div className="h-3.5" />
        <SideLabel>Coordinator</SideLabel>
        <SideRow href="/backstage" active={pathname === "/backstage"}>
          <Icon
            name="shield"
            size={16}
            color={
              pathname === "/backstage"
                ? "var(--color-accent)"
                : "var(--color-glow)"
            }
          />
          Backstage
        </SideRow>
      </div>

      {/* User footer */}
      <div className="flex items-center gap-2.5 border-t border-line px-3.5 py-3">
        <Avatar who="maya" size={30} />
        <div className="flex-1 min-w-0">
          <div className="truncate text-[13.5px] font-bold text-ink">
            {userName}
          </div>
          <div className="text-[11px] text-ink-3">{userRole}</div>
        </div>
        <Icon name="bell" size={17} color="var(--color-ink-3)" />
      </div>
    </aside>
  );
}
