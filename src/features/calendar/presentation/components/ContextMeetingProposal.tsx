"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Icon } from "@/shared/ui";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

interface ProposalResponse {
  meetingId: string;
  start: string;
  end: string;
  durationMinutes: number;
  rationale: string;
  draftMessage: string;
  model: string;
}

interface ContextMeetingProposalProps {
  expertId: string;
  expertName: string;
  viewerConnected: boolean;
  expertConnected: boolean;
}

/**
 * Surfaces the LLM-driven scheduling: a member who needs project context
 * describes why, and Mira proposes a shared slot pulled from both people's
 * Google Calendars (busy/free only) and drafts a warm request message.
 */
export function ContextMeetingProposal({
  expertId,
  expertName,
  viewerConnected,
  expertConnected,
}: ContextMeetingProposalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [locale] = useLocale();

  if (!viewerConnected) {
    return (
      <NoticeCard>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {t(locale, "cal.ctx.needViewerPre")}
          <Link
            href="/settings"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {t(locale, "cal.ctx.needViewerLink")}
          </Link>
          {t(locale, "cal.ctx.needViewerPost")}
        </p>
      </NoticeCard>
    );
  }

  if (!expertConnected) {
    return (
      <NoticeCard>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {t(locale, "cal.ctx.expertNotConnected", { name: expertName })}
        </p>
      </NoticeCard>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 4) {
      toast.error(t(locale, "cal.ctx.reasonError"));
      return;
    }
    setLoading(true);
    setProposal(null);
    try {
      const data = await fetchJson<ProposalResponse>("/api/calendar/propose-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId, reason: reason.trim() }),
      });
      setProposal(data);
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t(locale, "cal.ctx.proposeError");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="clock" size={18} color="var(--color-accent)" />
        <h3 className="text-[14px] font-bold uppercase tracking-[0.14em] text-ink-3">
          {t(locale, "cal.ctx.title")}
        </h3>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-[13px] text-ink-2">
          {t(locale, "cal.ctx.label", { name: expertName })}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder={t(locale, "cal.ctx.placeholder")}
          className="w-full resize-none rounded-xl border border-line bg-bg px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button type="submit" variant="ghost" size="sm" icon="spark" disabled={loading}>
          {loading ? t(locale, "cal.ctx.searching") : t(locale, "cal.ctx.propose")}
        </Button>
      </form>

      {proposal && (
        <div className="mt-4 rounded-xl border border-line-2 bg-bg p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
              {t(locale, "cal.ctx.proposed")}
            </span>
            <span className="text-xs text-ink-3">
              {t(locale, "cal.ctx.min", { count: proposal.durationMinutes })}
            </span>
          </div>
          <p className="mt-2 font-display text-[16px] text-ink">
            {formatRange(locale, proposal.start, proposal.end)}
          </p>
          {proposal.rationale && (
            <p className="mt-1 text-[13px] text-ink-3">{proposal.rationale}</p>
          )}
          <div className="mt-3 rounded-lg bg-surface p-3">
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              “{proposal.draftMessage}”
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(proposal.draftMessage)
                .then(() => toast.success(t(locale, "cal.ctx.copied")))
                .catch(() => toast.error(t(locale, "cal.ctx.copyError")));
            }}
            className="mt-3 text-[13px] font-semibold text-accent hover:underline"
          >
            {t(locale, "cal.ctx.copy")}
          </button>
        </div>
      )}
    </div>
  );
}

function NoticeCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">{children}</div>
  );
}

function formatRange(locale: string, startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const day = s.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const sh = s.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const eh = e.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${cap(day)}, ${sh}–${eh}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
