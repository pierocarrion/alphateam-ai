"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Alpha, Icon } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import type { TeamOverview } from "../../../domain/entities/TeamOverview";
import { useTeamAssistant } from "./useTeamAssistant";
import {
  AssistantMessageView,
  type QuickActionKind,
} from "./AssistantMessage";
import { SUGGESTED_QUESTIONS } from "./suggestedQuestions";

interface TeamAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * The live dashboard overview. Used to (a) drive the empty-state guide when
   * there is no data and (b) compute the filter query so the assistant stays
   * in sync with the visible dashboard. The actual grounding data is always
   * re-fetched server-side.
   */
  overview: TeamOverview | null;
  /** Active dashboard filters, serialized as a query string. */
  filterQuery?: string;
  daysWindow?: number;
}

const DRAWER_WIDTH = "w-[clamp(320px,92vw,460px)]";

export function TeamAssistantDrawer({
  open,
  onClose,
  overview,
  filterQuery = "",
  daysWindow = 90,
}: TeamAssistantDrawerProps) {
  const [locale] = useLocale();
  const assistant = useTeamAssistant({ daysWindow, filterQuery });
  const [draft, setDraft] = useState("");
  const [evidenceFor, setEvidenceFor] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new turns.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [assistant.messages.length, assistant.sending]);

  // Esc to close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hasMembers = (overview?.headcount ?? 0) > 0;

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || assistant.sending) return;
      void assistant.ask(trimmed);
      setDraft("");
    },
    [assistant]
  );

  const onSubmit = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  const onQuickAction = useCallback(
    (kind: QuickActionKind) => {
      if (kind === "evidence") {
        // Toggle inline evidence panel on the LAST assistant message.
        const last = [...assistant.messages].reverse().find((m) => m.role === "assistant");
        if (!last) return;
        setEvidenceFor((prev) => {
          const next = new Set(prev);
          if (next.has(last.id)) next.delete(last.id);
          else next.add(last.id);
          return next;
        });
        return;
      }

      const prompts: Record<Exclude<QuickActionKind, "evidence">, string> = {
        explain:
          locale === "es"
            ? "Explícame con más detalle el punto anterior, como si yo estuviera aprendiendo a leer este dashboard."
            : "Explain the previous point in more detail, as if I were learning how to read this dashboard.",
        compare:
          locale === "es"
            ? "Compara el estado actual del equipo con el mes pasado. ¿Qué mejoró y qué empeoró?"
            : "Compare the team's current state with last month. What improved and what got worse?",
        summary:
          locale === "es"
            ? "Genera un resumen ejecutivo del dashboard en 5 viñetas."
            : "Generate an executive summary of the dashboard in 5 bullets.",
        improve:
          locale === "es"
            ? "Sugiere 3 mejoras concretas y priorizadas para el equipo."
            : "Suggest 3 concrete, prioritized improvements for the team.",
      };
      send(prompts[kind]);
    },
    [assistant.messages, locale, send]
  );

  const thinking = assistant.sending;

  const visibleSuggested = useMemo(
    () => SUGGESTED_QUESTIONS.map((q) => ({ id: q.id, label: q.text(locale) })),
    [locale]
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      {/* Scrim: keeps the dashboard partially visible behind the drawer */}
      <button
        type="button"
        aria-label={t(locale, "insights.assistant.aria.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/35 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t(locale, "insights.assistant.title")}
        className={cn(
          "absolute right-0 top-0 flex h-full flex-col border-l border-line bg-bg-2 shadow-2xl transition-transform duration-300 ease-out",
          DRAWER_WIDTH,
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <AssistantHeader onClose={onClose} locale={locale} />

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3.5 py-3"
        >
          <Intro locale={locale} subtitle />

          {/* Empty dashboard guidance: shows BEFORE any question is asked. */}
          {!hasMembers && assistant.messages.length === 0 && (
            <div className="rounded-card border border-dashed border-line-2 bg-surface/60 p-3 text-[12.5px] leading-relaxed text-ink-3">
              {t(locale, "insights.assistant.empty.guide")}
            </div>
          )}

          {assistant.messages.length === 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
                {t(locale, "insights.assistant.suggested")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleSuggested.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => send(q.label)}
                    className="rounded-pill border border-line bg-surface px-2.5 py-1.5 text-left text-[11.5px] leading-tight text-ink-2 transition-all hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              {assistant.messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} text={m.content} />
                ) : (
                  <AssistantMessageView
                    key={m.id}
                    message={m}
                    showEvidence={evidenceFor.has(m.id)}
                    onQuickAction={onQuickAction}
                  />
                )
              )}

              {thinking && <Thinking locale={locale} />}
              {assistant.error && !thinking && (
                <p className="rounded-card border border-[#E0625A]/30 bg-[#E0625A]/10 p-2.5 text-[12px] text-[#E0625A]">
                  {assistant.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line p-3">
          <div className="flex items-end gap-2 rounded-card border border-line bg-surface p-1.5 focus-within:border-accent/60">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onSubmit}
              placeholder={t(locale, "insights.assistant.placeholder")}
              rows={1}
              className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
              aria-label={t(locale, "insights.assistant.placeholder")}
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={!draft.trim() || thinking}
              aria-label={t(locale, "insights.assistant.aria.send")}
              className={cn(
                "flex flex-none items-center justify-center rounded-pill p-2 transition-all",
                draft.trim() && !thinking
                  ? "bg-accent text-accent-ink hover:scale-105"
                  : "bg-surface-2 text-ink-3"
              )}
            >
              <Icon name="send" size={14} color="currentColor" />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-ink-3">
            {locale === "es"
              ? "Alpha usa solo los datos visibles del dashboard."
              : "Alpha uses only data visible on the dashboard."}
          </p>
        </div>
      </aside>
    </div>
  );
}

function AssistantHeader({
  onClose,
  locale,
}: {
  onClose: () => void;
  locale: ReturnType<typeof useLocale>[0];
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Alpha size={32} mood="thinking" />
        <div className="min-w-0">
          <p className="truncate font-display text-[14px] font-bold text-ink">
            {t(locale, "insights.assistant.title")}
          </p>
          <p className="truncate text-[11px] text-ink-3">
            {t(locale, "insights.assistant.subtitle")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t(locale, "insights.assistant.aria.close")}
        className="rounded-button p-1.5 text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink"
      >
        <Icon name="close" size={16} />
      </button>
    </header>
  );
}

function Intro({
  locale,
  subtitle,
}: {
  locale: ReturnType<typeof useLocale>[0];
  subtitle?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-none pt-0.5">
        <Alpha size={26} mood="calm" />
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-2">
        {subtitle
          ? t(locale, "insights.assistant.subtitle")
          : t(locale, "insights.assistant.empty.guide")}
      </p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-pill bg-accent-soft px-3 py-2 text-[12.5px] leading-snug text-ink">
        {text}
      </p>
    </div>
  );
}

function Thinking({
  locale,
}: {
  locale: ReturnType<typeof useLocale>[0];
}) {
  return (
    <div className="flex items-center gap-2 px-1 text-[12px] text-ink-3">
      <Alpha size={20} mood="thinking" />
      <span className="flex gap-1">
        <Dot delay="0s" />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
      </span>
      <span className="sr-only">{t(locale, "insights.assistant.thinking")}</span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-accent"
      style={{
        animation: "typing-dot 1.2s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}
