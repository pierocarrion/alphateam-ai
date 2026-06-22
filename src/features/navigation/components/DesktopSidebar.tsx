"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { Avatar, Icon, Mira } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import { personIdFromName } from "@/shared/lib/person";

export interface SidebarChannel {
  id: string;
  name: string;
}

export interface SidebarMember {
  id: string;
  name: string;
}

interface DesktopSidebarProps {
  workspaceName: string;
  workspaceEmoji?: string | null;
  workspaceHashtag?: string | null;
  channels: SidebarChannel[];
  members: SidebarMember[];
  dmByPeer: Record<string, string>;
  userName: string;
  userRole: string;
  showBackstage: boolean;
  pendingRequests?: number;
}

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

export function DesktopSidebar({
  workspaceName,
  workspaceEmoji,
  workspaceHashtag,
  channels,
  members,
  dmByPeer,
  userName,
  userRole,
  showBackstage,
  pendingRequests,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [openingDm, setOpeningDm] = useState<string | null>(null);

  const selfPersonId = personIdFromName(userName || "you");
  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  const openDm = async (member: SidebarMember) => {
    if (openingDm) return;
    setOpeningDm(member.id);
    try {
      const data = await fetchJson<{ channel: { id: string } }>("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: member.id }),
      });
      if (data.channel?.id) {
        router.push(`/chat/${data.channel.id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "We couldn't open that conversation. Please try again."
      );
    } finally {
      setOpeningDm(null);
    }
  };

  return (
    <aside className="hidden w-[244px] flex-none flex-col border-r border-line bg-bg-2 lg:flex">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-[18px] pb-3.5">
        <Mira size={30} mood="calm" />
        <div className="min-w-0">
          <div className="truncate font-display text-base text-ink">
            {workspaceEmoji ? `${workspaceEmoji} ` : ""}
            {workspaceName}
          </div>
          <div className="truncate text-[11px] text-ink-3">
            {workspaceHashtag ?? "proyecto"} · espacio
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3.5">
        <SideLabel>Channels</SideLabel>
        {channels.length === 0 && (
          <p className="px-2.5 pb-1 text-xs text-ink-3">No channels yet.</p>
        )}
        {channels.map((c) => (
          <SideRow
            key={c.id}
            href={`/chat/${c.id}`}
            active={pathname === `/chat/${c.id}`}
          >
            <span className="text-ink-3">#</span> {c.name}
          </SideRow>
        ))}

        <div className="h-3.5" />
        <SideLabel>Direct messages</SideLabel>
        {members.length === 0 && (
          <p className="px-2.5 pb-1 text-xs text-ink-3">No one else here yet.</p>
        )}
        {members.map((m) => {
          const channelId = dmByPeer[m.id];
          const active = channelId ? pathname === `/chat/${channelId}` : false;
          return (
            <button
              key={m.id}
              onClick={() => openDm(m)}
              disabled={openingDm === m.id}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[14.5px] font-semibold transition-colors disabled:opacity-60",
                active
                  ? "bg-accent-soft text-ink"
                  : "text-ink-2 hover:bg-white/[0.03]"
              )}
            >
              <Avatar who={personIdFromName(m.name)} size={20} />
              {m.name?.split(" ")[0] ?? "Someone"}
            </button>
          );
        })}

        {showBackstage && (
          <>
            <div className="h-3.5" />
            <SideLabel>Coordinación</SideLabel>
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
            <SideRow href="/requests" active={pathname === "/requests"}>
              <Icon
                name="crew"
                size={16}
                color={
                  pathname === "/requests"
                    ? "var(--color-accent)"
                    : "var(--color-ink-3)"
                }
              />
              Solicitudes
              {pendingRequests && pendingRequests > 0 ? (
                <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                  {pendingRequests}
                </span>
              ) : null}
            </SideRow>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="flex items-center gap-2.5 border-t border-line px-3.5 py-3">
        <Avatar who={selfPersonId} size={30} />
        <div className="flex-1 min-w-0">
          <div className="truncate text-[13.5px] font-bold text-ink">
            {userName || "you"}
          </div>
          <div className="text-[11px] text-ink-3">{roleLabel}</div>
        </div>
        <Icon name="bell" size={17} color="var(--color-ink-3)" />
      </div>
    </aside>
  );
}
