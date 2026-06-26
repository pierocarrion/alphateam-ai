"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { Avatar, Icon } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import { personIdFromName } from "@/shared/lib/person";
import { LanguageToggle } from "@/i18n/LanguageToggle";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import {
  WorkspaceSwitcher,
  type SwitcherWorkspace,
} from "./WorkspaceSwitcher";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import { useFcmToken } from "@/features/notifications/useFcmToken";

export interface SidebarChannel {
  id: string;
  name: string;
}

export interface SidebarMember {
  id: string;
  name: string;
}

export type SidebarWorkspace = SwitcherWorkspace;

interface DesktopSidebarProps {
  workspaceId: string;
  workspaceName: string;
  workspaceEmoji?: string | null;
  workspaceHashtag?: string | null;
  channels: SidebarChannel[];
  members: SidebarMember[];
  dmByPeer: Record<string, string>;
  workspaces: SidebarWorkspace[];
  currentUserId: string;
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
  workspaceId,
  workspaceName,
  workspaceEmoji,
  workspaceHashtag,
  channels,
  members,
  dmByPeer,
  workspaces,
  currentUserId,
  userName,
  userRole,
  showBackstage,
  pendingRequests,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [locale] = useLocale();
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, k, v);
  const [openingDm, setOpeningDm] = useState<string | null>(null);

  // Register an FCM push token for the signed-in user (best-effort, no-op
  // until the Firebase SDK + VAPID key are configured).
  useFcmToken(true);

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
      {/* Workspace header (switcher) */}
      <div className="border-b border-line px-2.5 py-2.5">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeId={workspaceId}
          activeName={workspaceName}
          activeEmoji={workspaceEmoji}
          activeHashtag={workspaceHashtag}
        />
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3.5">
        <SideLabel>{tr("nav.channels")}</SideLabel>
        {channels.length === 0 && (
          <p className="px-2.5 pb-1 text-xs text-ink-3">{tr("nav.noChannels")}</p>
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
        <SideLabel>{tr("nav.team")}</SideLabel>
        <SideRow href="/members" active={pathname === "/members"}>
          <Icon
            name="people"
            size={16}
            color={
              pathname === "/members"
                ? "var(--color-accent)"
                : "var(--color-ink-3)"
            }
          />
          {tr("nav.members")}
        </SideRow>
        <SideRow href="/tasks" active={pathname === "/tasks"}>
          <Icon
            name="target"
            size={16}
            color={
              pathname === "/tasks"
                ? "var(--color-accent)"
                : "var(--color-ink-3)"
            }
          />
          {tr("nav.tasks")}
        </SideRow>
        {members.length === 0 && (
          <p className="px-2.5 pb-1 text-xs text-ink-3">
            {tr("nav.noMembers")}
          </p>
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
              <Avatar
                who={personIdFromName(m.name)}
                size={20}
                href={`/profile/${m.id}`}
              />
              {m.name?.split(" ")[0] ?? "Someone"}
            </button>
          );
        })}

        {showBackstage && (
          <>
            <div className="h-3.5" />
            <SideLabel>{tr("nav.coordination")}</SideLabel>
            <SideRow href="/progress" active={pathname === "/progress"}>
              <Icon
                name="spark"
                size={16}
                color={
                  pathname === "/progress"
                    ? "var(--color-accent)"
                    : "var(--color-ink-3)"
                }
              />
              {tr("nav.progress")}
            </SideRow>
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
              {tr("nav.backstage")}
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
              {tr("nav.requests")}
              {pendingRequests && pendingRequests > 0 ? (
                <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                  {pendingRequests}
                </span>
              ) : null}
            </SideRow>
            <SideRow href="/knowledge" active={pathname === "/knowledge"}>
              <Icon
                name="doc"
                size={16}
                color={
                  pathname === "/knowledge"
                    ? "var(--color-accent)"
                    : "var(--color-ink-3)"
                }
              />
              {tr("nav.knowledge")}
            </SideRow>
            <SideRow href="/alpha-space" active={pathname.startsWith("/alpha-space")}>
              <Icon
                name="compass"
                size={16}
                color={
                  pathname.startsWith("/alpha-space")
                    ? "var(--color-accent)"
                    : "var(--color-glow)"
                }
              />
              {tr("nav.alphaSpace")}
            </SideRow>
            <SideRow
              href="/feedback-intelligence"
              active={pathname.startsWith("/feedback-intelligence")}
            >
              <Icon
                name="pulse"
                size={16}
                color={
                  pathname.startsWith("/feedback-intelligence")
                    ? "var(--color-accent)"
                    : "var(--color-glow)"
                }
              />
              {tr("nav.feedback")}
            </SideRow>
            <SideRow
              href="/team-insights"
              active={pathname.startsWith("/team-insights")}
            >
              <Icon
                name="trend"
                size={16}
                color={
                  pathname.startsWith("/team-insights")
                    ? "var(--color-accent)"
                    : "var(--color-glow)"
                }
              />
              {tr("nav.teamInsights")}
            </SideRow>
            <SideRow
              href="/project/settings"
              active={pathname === "/project/settings"}
            >
              <Icon
                name="gear"
                size={16}
                color={
                  pathname === "/project/settings"
                    ? "var(--color-accent)"
                    : "var(--color-ink-3)"
                }
              />
              {tr("nav.projectSettings")}
            </SideRow>
          </>
        )}
      </div>

      {/* User footer (clickable profile) */}
      <div className="flex flex-col gap-1.5 border-t border-line px-2.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/profile/${currentUserId}`}
            className="flex flex-1 items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.03]"
          >
            <Avatar who={selfPersonId} size={30} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[13.5px] font-bold text-ink">
                {userName || "you"}
              </div>
              <div className="text-[11px] text-ink-3">{roleLabel}</div>
            </div>
          </Link>
          <LanguageToggle className="shrink-0" />
          <NotificationCenter />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label={tr("nav.logout")}
            title={tr("nav.logout")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-white/[0.05] hover:text-ink"
          >
            <Icon name="logout" size={17} color="currentColor" />
          </button>
        </div>
      </div>
    </aside>
  );
}
