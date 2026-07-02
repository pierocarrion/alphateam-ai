"use client";

import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";
import { Markdown } from "./Markdown";
import type { AssistantMessage as AssistantMessageType } from "./useTeamAssistant";
import type { AssistantConfidence } from "../../../application/assistant/AskTeamAssistant";

interface AssistantMessageProps {
  message: AssistantMessageType;
  /** Whether to show the compact evidence list inline (toggled by quick action). */
  showEvidence: boolean;
  onQuickAction: (kind: QuickActionKind, ctx?: { message: AssistantMessageType }) => void;
}

export type QuickActionKind =
  | "explain"
  | "evidence"
  | "compare"
  | "summary"
  | "improve";

interface QuickAction {
  kind: QuickActionKind;
  labelKey: string;
  icon: "compass" | "target" | "trend" | "doc" | "spark";
}

const QUICK_ACTIONS: QuickAction[] = [
  { kind: "explain", labelKey: "insights.assistant.quick.explain", icon: "compass" },
  { kind: "evidence", labelKey: "insights.assistant.quick.evidence", icon: "target" },
  { kind: "compare", labelKey: "insights.assistant.quick.compare", icon: "trend" },
  { kind: "summary", labelKey: "insights.assistant.quick.summary", icon: "doc" },
  { kind: "improve", labelKey: "insights.assistant.quick.improve", icon: "spark" },
];

export function AssistantMessageView({
  message,
  showEvidence,
  onQuickAction,
}: AssistantMessageProps) {
  const [locale] = useLocale();
  const answer = message.answer;

  return (
    <article
      className={cn(
        "rounded-card border border-line bg-surface-2/60 p-3.5",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]"
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">
        <Icon name="spark" size={11} color="var(--color-accent)" />
        <span>Alpha</span>
      </div>

      <Markdown text={answer?.reply ?? message.content} />

      {answer && answer.confidenceReason && (
        <Confidence
          level={answer.confidence}
          reason={answer.confidenceReason}
          locale={locale}
        />
      )}

      {answer && answer.recommendedActions.length > 0 && (
        <section className="mt-3 rounded-button border border-line bg-bg-2/60 p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            <Icon name="compass" size={11} color="var(--color-accent)" />
            {t(locale, "insights.assistant.actions")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {answer.recommendedActions.map((action, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-2"
              >
                <span
                  aria-hidden
                  className="mt-[0.45em] h-1 w-1 flex-none rounded-full bg-accent"
                />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showEvidence && answer && answer.evidence.length > 0 && (
        <section className="mt-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
            <Icon name="target" size={11} />
            {t(locale, "insights.assistant.evidence")}
          </p>
          <ul className="flex flex-col gap-1">
            {answer.evidence.map((e, idx) => (
              <li
                key={idx}
                className="rounded-button bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] italic leading-snug text-ink-3"
              >
                “{e}”
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
          {QUICK_ACTIONS.map((qa) => {
            const active = qa.kind === "evidence" && showEvidence;
            return (
              <button
                key={qa.kind}
                type="button"
                onClick={() => onQuickAction(qa.kind, { message })}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[10.5px] font-semibold transition-all",
                  active
                    ? "border-accent/60 bg-accent-soft text-accent"
                    : "border-line text-ink-3 hover:border-accent/40 hover:text-ink-2"
                )}
              >
                <Icon name={qa.icon} size={10} color="currentColor" />
                {t(locale, qa.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function Confidence({
  level,
  reason,
  locale,
}: {
  level: AssistantConfidence;
  reason: string;
  locale: ReturnType<typeof useLocale>[0];
}) {
  const tone =
    level === "High"
      ? { dot: "var(--color-sage)", label: "text-[#93c2a2]", soft: "rgba(147,194,162,0.10)" }
      : level === "Medium"
        ? { dot: "#E6B45A", label: "text-[#E6B45A]", soft: "rgba(230,180,90,0.10)" }
        : { dot: "#E0625A", label: "text-[#E0625A]", soft: "rgba(224,98,90,0.10)" };

  return (
    <div
      className="mt-2.5 flex items-start gap-2 rounded-button px-2.5 py-1.5"
      style={{ background: tone.soft }}
    >
      <span
        aria-hidden
        className="mt-[0.45em] h-1.5 w-1.5 flex-none rounded-full"
        style={{ background: tone.dot }}
      />
      <p className="text-[11.5px] leading-snug text-ink-2">
        <span className={cn("font-bold uppercase tracking-[0.1em]", tone.label)}>
          {t(locale, "insights.assistant.confidence")}: {level}
        </span>
        {reason && <span className="text-ink-3"> — {reason}</span>}
      </p>
    </div>
  );
}
