"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, Card } from "@/shared/ui";
import { PersonId } from "@/shared/ui";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { personIdFromName } from "@/shared/lib/person";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import { SectionHeader } from "./primitives";

interface PendingRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

export function PendingRequests({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [locale] = useLocale();
  const [acting, setActing] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ requests: PendingRequest[] }>({
    queryKey: ["project-settings", workspaceId, "pending-requests"],
    queryFn: () => fetchJson("/api/projects/requests"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const requests = data?.requests ?? [];

  const decide = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "rejected";
    }) =>
      fetchJson(`/api/projects/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.decision === "approved"
          ? t(locale, "ps.requests.accepted")
          : t(locale, "ps.requests.rejected")
      );
      qc.invalidateQueries({ queryKey: ["project-settings", workspaceId] });
      qc.invalidateQueries({
        queryKey: ["project-settings", workspaceId, "pending-requests"],
      });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t(locale, "ps.requests.error");
      toast.error(msg);
    },
  });

  const onDecide = (id: string, decision: "approved" | "rejected") => {
    setActing(id);
    decide.mutate(
      { id, decision },
      {
        onSettled: () => setActing(null),
      }
    );
  };

  if (isLoading || requests.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 border-accent/40 bg-accent/[0.04] p-5">
      <SectionHeader
        title={t(locale, "ps.requests.title")}
        description={t(locale, "ps.requests.desc")}
        hint={`${requests.length} ${t(locale, "ps.requests.pendingSuffix")}`}
      />

      <div className="flex flex-col gap-2.5">
        {requests.map((r) => {
          const who = personIdFromName(r.userName ?? "Someone") as PersonId;
          return (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5"
            >
              <div className="flex items-center gap-3">
                <Avatar who={who} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14.5px] font-bold text-ink">
                      {r.userName ?? t(locale, "ps.requests.someone")}
                    </p>
                    <span className="rounded-full bg-glow-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-glow">
                      {t(locale, "ps.requests.pending")}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-ink-3">
                    {r.userEmail ?? ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {r.message && (
                <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
                  “{r.message}”
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={acting === r.id}
                  onClick={() => onDecide(r.id, "approved")}
                  className="flex-1 rounded-button bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-50"
                >
                  {t(locale, "ps.requests.accept")}
                </button>
                <button
                  type="button"
                  disabled={acting === r.id}
                  onClick={() => onDecide(r.id, "rejected")}
                  className="flex-1 rounded-button border border-line px-4 py-2 text-[13px] font-semibold text-glow hover:bg-surface-2 disabled:opacity-50"
                >
                  {t(locale, "ps.requests.reject")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
