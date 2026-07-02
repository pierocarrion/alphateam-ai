"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { fetchJson } from "@/shared/lib/api";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
}

function relativeTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return locale === "en" ? "now" : "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function deepLink(n: NotificationItem): string | null {
  const data = n.data ?? {};
  const ws = typeof data.workspaceId === "string" ? data.workspaceId : null;
  switch (n.type) {
    case "join_approved":
    case "join_rejected":
    case "join_request_received":
      return "/project/settings";
    case "task_assigned":
      return ws ? `/${ws}/tasks` : null;
    case "invite_received":
      return ws ? `/${ws}/team` : null;
    case "dm_started":
      return "/chat";
    case "payment_failed":
    case "subscription_cancelled":
      return "/settings/billing";
    case "admin_action":
      return null;
    default:
      return null;
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [locale] = useLocale();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => fetchJson<NotificationsResponse>("/api/notifications"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  const markOne = useMutation({
    mutationFn: (id: string) =>
      fetchJson("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => fetchJson("/api/notifications", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t(locale, "notif.bell")}
        title={t(locale, "notif.bell")}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-white/[0.05] hover:text-ink"
      >
        <Icon name="bell" size={17} color="currentColor" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[13px] font-bold text-ink">
              {t(locale, "notif.title")}
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                {t(locale, "notif.markAll")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-ink-3">
                {t(locale, "notif.empty")}
              </div>
            ) : (
              items.map((n) => {
                const href = deepLink(n);
                const Wrapper = href ? "a" : "div";
                return (
                  <Wrapper
                    key={n.id}
                    {...(href ? { href } : {})}
                    onClick={() => {
                      if (!n.readAt) markOne.mutate(n.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex cursor-pointer gap-2.5 border-b border-line/60 px-4 py-3 transition-colors hover:bg-white/[0.03]",
                      !n.readAt && "bg-accent/[0.06]"
                    )}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-2">
                      <Icon name="bell" size={13} color="var(--color-ink-3)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12.5px] font-bold text-ink">
                          {n.title}
                        </span>
                        {!n.readAt && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-2">
                        {n.body}
                      </p>
                      <span className="mt-0.5 text-[10px] text-ink-3">
                        {relativeTime(n.createdAt, locale)}
                      </span>
                    </div>
                  </Wrapper>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
