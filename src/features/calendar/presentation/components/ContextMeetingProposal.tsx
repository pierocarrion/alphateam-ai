"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Icon } from "@/shared/ui";
import { fetchJson, ApiError } from "@/shared/lib/api";

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

  if (!viewerConnected) {
    return (
      <NoticeCard>
        <p className="text-[14px] leading-relaxed text-ink-2">
          Para proponer una sesión de contexto, conecta primero tu Google
          Calendar en{" "}
          <Link
            href="/settings"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            Ajustes
          </Link>
          . Así Mira puede ver tus huecos libres.
        </p>
      </NoticeCard>
    );
  }

  if (!expertConnected) {
    return (
      <NoticeCard>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {expertName} aún no conecta su Google Calendar. Cuando lo haga, Mira
          podrá proponerles un horario en común.
        </p>
      </NoticeCard>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 4) {
      toast.error("Cuéntanos brevemente qué contexto necesitas.");
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
          : "No pudimos proponer un horario ahora.";
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
          Sesión de contexto
        </h3>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-[13px] text-ink-2">
          ¿Qué contexto necesitas de {expertName}?
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Ej: entender el estado del lanzamiento Q3 antes de armar el deck."
          className="w-full resize-none rounded-xl border border-line bg-bg px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button type="submit" variant="ghost" size="sm" icon="spark" disabled={loading}>
          {loading ? "Buscando hueco…" : "Proponer horario"}
        </Button>
      </form>

      {proposal && (
        <div className="mt-4 rounded-xl border border-line-2 bg-bg p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
              Horario propuesto
            </span>
            <span className="text-xs text-ink-3">
              {proposal.durationMinutes} min
            </span>
          </div>
          <p className="mt-2 font-display text-[16px] text-ink">
            {formatRange(proposal.start, proposal.end)}
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
                .then(() => toast.success("Mensaje copiado."))
                .catch(() => toast.error("No pudimos copiar el mensaje."));
            }}
            className="mt-3 text-[13px] font-semibold text-accent hover:underline"
          >
            Copiar mensaje
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

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const day = s.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const sh = s.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const eh = e.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${cap(day)}, ${sh}–${eh}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
