"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { Avatar, Icon } from "@/shared/ui";
import type { IconName, PresenceStatus } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import { personIdFromName } from "@/shared/lib/person";
import { presenceFromUserId } from "@/shared/lib/presence";
import { LanguageToggle } from "@/i18n/LanguageToggle";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import {
  WorkspaceSwitcher,
  type SwitcherWorkspace,
} from "./WorkspaceSwitcher";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import { useFcmToken } from "@/features/notifications/useFcmToken";
import { CurrentPhaseBadge } from "@/features/project-phases/presentation/components/CurrentPhaseBadge";

export interface SidebarChannel {
  id: string;
  name: string;
}

export interface SidebarMember {
  id: string;
  name: string;
  role?: string;
  projectRole?: string | null;
  photoUrl?: string | null;
  status?: string | null;
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
  icon?: IconName;
  iconColor?: string;
  featured?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function SideRow({
  href,
  active,
  icon,
  iconColor,
  featured,
  badge,
  children,
}: SideRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[14px] font-medium transition-colors",
        active
          ? "bg-accent-soft text-ink"
          : "text-ink-2 hover:bg-white/[0.03] hover:text-ink"
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
        />
      )}
      {icon && (
        <Icon
          name={icon}
          size={17}
          color={active ? "var(--color-accent)" : iconColor ?? "var(--color-ink-3)"}
          stroke={2}
        />
      )}
      <span className={cn("truncate", featured && "font-semibold")}>{children}</span>
      {featured && (
        <span aria-hidden className="text-[12px] leading-none text-accent">
          ★
        </span>
      )}
      {badge && <span className="ml-auto">{badge}</span>}
    </Link>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </div>
  );
}

function SideSection({ children }: { children: React.ReactNode }) {
  return <div className="pb-5">{children}</div>;
}

function Collapsible({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-0.5 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[14px] font-medium text-ink-2 transition-colors hover:bg-white/[0.03] hover:text-ink"
        aria-expanded={open}
      >
        <Icon
          name="chevron"
          size={14}
          color="var(--color-ink-3)"
          className={cn("transition-transform", open ? "" : "-rotate-90")}
        />
        <span className="truncate">{label}</span>
      </button>
      {open && <div className="ml-1.5 border-l border-line pl-1.5">{children}</div>}
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
        body: JSON.stringify({ partnerId: member.id, workspaceId }),
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
        {showBackstage && <CurrentPhaseBadge workspaceId={workspaceId} />}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {/* Project */}
        <SideSection>
          <SideLabel>{tr("nav.projectGroup")}</SideLabel>
          <SideRow href="/home" active={pathname === "/home"} icon="home">
            {tr("nav.home")}
          </SideRow>
          <SideRow href="/progress" active={pathname === "/progress"} icon="trend">
            {tr("nav.progress")}
          </SideRow>
          {showBackstage && (
            <SideRow href="/tasks" active={pathname === "/tasks"} icon="target">
              {tr("nav.tasks")}
            </SideRow>
          )}
          {showBackstage && (
            <SideRow
              href="/project/settings"
              active={pathname === "/project/settings"}
              icon="gear"
              badge={
                pendingRequests && pendingRequests > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                    {pendingRequests}
                  </span>
                ) : null
              }
            >
              {tr("nav.projectSettings")}
            </SideRow>
          )}
        </SideSection>

        {/* Channels — conversations (channels + direct messages) */}
        <SideSection>
          <SideLabel>{tr("nav.channels")}</SideLabel>

          {channels.length === 0 && (
            <p className="px-2.5 py-1.5 text-xs text-ink-3">
              {tr("nav.noChannels")}
            </p>
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

          {/* Direct messages — collapsible, with avatar + presence */}
          {members.length > 0 && (
            <Collapsible label={tr("nav.directMessages")} defaultOpen={false}>
              {members.map((m) => {
                const channelId = dmByPeer[m.id];
                const active = channelId
                  ? pathname === `/chat/${channelId}`
                  : false;
                const presence: PresenceStatus = presenceFromUserId(
                  m.id,
                  m.status
                );
                return (
                  <button
                    key={m.id}
                    onClick={() => openDm(m)}
                    disabled={openingDm === m.id}
                    className={cn(
                      "mb-0.5 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[13.5px] font-medium transition-colors disabled:opacity-60",
                      active
                        ? "bg-accent-soft text-ink"
                        : "text-ink-2 hover:bg-white/[0.03]"
                    )}
                  >
                    <Avatar
                      who={personIdFromName(m.name)}
                      size={22}
                      href={`/profile/${m.id}`}
                      status={presence}
                    />
                    <span className="truncate">
                      {m.name?.split(" ")[0] ?? "Someone"}
                    </span>
                  </button>
                );
              })}
            </Collapsible>
          )}
        </SideSection>

        {/* Team — people directory */}
        <SideSection>
          <SideLabel>{tr("nav.team")}</SideLabel>
          <SideRow href="/members" active={pathname === "/members"} icon="people">
            {tr("nav.members")}
          </SideRow>
          <SideRow
            href="/team-insights"
            active={pathname.startsWith("/team-insights")}
            icon="pulse"
          >
            {tr("nav.teamInsights")}
          </SideRow>
          <SideRow
            href="/knowledge"
            active={pathname === "/knowledge"}
            icon="grid"
          >
            {tr("nav.database")}
          </SideRow>
        </SideSection>

        {/* Coordination */}
        <SideSection>
          <SideLabel>{tr("nav.coordination")}</SideLabel>
          {showBackstage && (
            <SideRow
              href="/project/phases"
              active={pathname === "/project/phases"}
              icon="spark"
              featured
            >
              {tr("nav.projectPhases")}
            </SideRow>
          )}
          <SideRow
            href="/alpha-space"
            active={pathname.startsWith("/alpha-space")}
            icon="compass"
            iconColor="var(--color-glow)"
          >
            {tr("nav.alphaSpace")}
          </SideRow>
          <SideRow
            href="/feedback-intelligence"
            active={pathname.startsWith("/feedback-intelligence")}
            icon="pulse"
            iconColor="var(--color-glow)"
          >
            {tr("nav.feedback")}
          </SideRow>
          {showBackstage && (
            <>
              <SideRow
                href="/backstage"
                active={pathname === "/backstage"}
                icon="shield"
              >
                {tr("nav.backstage")}
              </SideRow>
            </>
          )}
        </SideSection>
      </div>

      {/* User footer (clickable profile) */}
      <div className="flex flex-col gap-2 border-t border-line px-2.5 py-2.5">
        <Link
          href={`/profile/${currentUserId}`}
          className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.03]"
        >
          <Avatar who={selfPersonId} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold text-ink">
              {userName || "you"}
            </div>
            <div className="text-[11px] text-ink-3">{roleLabel}</div>
          </div>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <LanguageToggle className="shrink-0" />
          <div className="flex items-center gap-1">
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
      </div>
    </aside>
  );
}
