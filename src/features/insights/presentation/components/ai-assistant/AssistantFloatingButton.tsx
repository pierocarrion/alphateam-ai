"use client";

import { Alpha, Icon } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

interface AssistantFloatingButtonProps {
  open: boolean;
  onClick: () => void;
  /**
   * When true, the button emits a very subtle pulse to signal "there are new
   * important insights". Should be driven by the dashboard (e.g. critical
   * alerts or caution insights the leader hasn't opened yet).
   */
  hasNewInsights?: boolean;
}

/**
 * Discreet floating entry-point to the Team Insights Assistant.
 *
 * Placed in the bottom-right corner of the dashboard. It uses the product's
 * own "Alpha" orb (the official AI logo) wrapped in a quiet dark surface that
 * matches the existing visual system — so it reads as a co-pilot button, never
 * as an invasive chatbot.
 */
export function AssistantFloatingButton({
  open,
  onClick,
  hasNewInsights = false,
}: AssistantFloatingButtonProps) {
  const [locale] = useLocale();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(locale, "insights.assistant.aria.open")}
      aria-expanded={open}
      className={cn(
        "group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-pill",
        "border border-line bg-bg-2/90 px-3 py-2 backdrop-blur",
        "shadow-[0_8px_28px_-10px_rgba(0,0,0,0.6)]",
        "transition-all duration-300",
        "hover:border-accent/50 hover:bg-bg-2 hover:-translate-y-0.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      )}
      style={{
        // Subtle gold glow on hover only — never gaudy.
        boxShadow:
          "0 0 0 1px rgba(255,236,214,0.05), 0 8px 28px -10px rgba(0,0,0,0.6)",
      }}
    >
      {/* Pulse ring: only when there are NEW important insights AND the drawer is closed. */}
      {hasNewInsights && !open && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-pill"
          style={{
            border: "1.5px solid var(--color-accent)",
            animation: "pulse-ring calc(3.4s * var(--m, 1)) cubic-bezier(0.22, 0.61, 0.36, 1) infinite",
          }}
        />
      )}

      <span className="relative flex flex-none items-center justify-center">
        <Alpha
          size={26}
          mood="calm"
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </span>

      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
          {locale === "es" ? "Alpha" : "Alpha"}
        </span>
        <span className="text-[10.5px] text-ink-3">
          {locale === "es" ? "Copiloto del equipo" : "Team co-pilot"}
        </span>
      </span>

      <Icon
        name="spark"
        size={12}
        color="var(--color-accent)"
        className="opacity-60 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
