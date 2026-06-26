"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

export interface SwitcherWorkspace {
  id: string;
  name: string;
  emoji?: string | null;
  hashtag: string;
}

interface WorkspaceSwitcherProps {
  workspaces: SwitcherWorkspace[];
  activeId: string;
  activeName: string;
  activeEmoji?: string | null;
  activeHashtag?: string | null;
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  activeName,
  activeEmoji,
  activeHashtag,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locale] = useLocale();
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, k, v);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const select = async (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setSwitching(id);
    try {
      await fetchJson("/api/workspaces/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      // Drop any cached data tied to the previous workspace so the new
      // project never shows stale chats/tasks/metrics. Workspace-scoped
      // queries include workspaceId in their key, but several legacy keys
      // (channel, tasks, notifications, channel-insights, ...) do not, so
      // we clear them explicitly.
      queryClient.removeQueries({ queryKey: ["channel"] });
      queryClient.removeQueries({ queryKey: ["channel-insights"] });
      queryClient.removeQueries({ queryKey: ["tasks"] });
      queryClient.removeQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries();
      setOpen(false);
      // Force navigation away from any workspace-scoped route (e.g.
      // /chat/[channelId]) so we never render content from the previous
      // project while the layout refreshes.
      router.replace("/home");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tr("nav.switchError")
      );
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors",
          open ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-lg leading-none">
          {activeEmoji ? activeEmoji : "🚀"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] leading-tight text-ink">
            {activeName}
          </div>
          <div className="truncate text-[11px] leading-tight text-ink-3">
            {activeHashtag ?? tr("nav.project")} · {tr("nav.space")}
          </div>
        </div>
        <span
          className={cn(
            "transition-transform",
            open ? "rotate-90" : "rotate-0"
          )}
        >
          <Icon name="chevron" size={15} color="var(--color-ink-3)" />
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-2xl border border-line bg-bg-2 p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="px-2 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
              {tr("nav.yourProjects")}
            </div>
            {workspaces.map((w) => {
              const isActive = w.id === activeId;
              const loading = switching === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={switching !== null}
                  onClick={() => select(w.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors disabled:opacity-60",
                    isActive ? "bg-accent-soft" : "hover:bg-white/[0.04]"
                  )}
                >
                  <span className="text-base leading-none">
                    {w.emoji ? w.emoji : "🚀"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">
                      {w.name}
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-ink-3">
                      {w.hashtag}
                    </div>
                  </div>
                  {loading ? (
                    <span className="text-[10px] text-ink-3">…</span>
                  ) : isActive ? (
                    <Icon
                      name="check"
                      size={14}
                      color="var(--color-accent)"
                    />
                  ) : null}
                </button>
              );
            })}
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/projects/new");
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-ink-2 transition-colors hover:bg-white/[0.04]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon name="plus" size={14} color="var(--color-accent)" />
              </span>
              <span className="text-[13.5px] font-semibold">
                {tr("nav.createProject")}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
