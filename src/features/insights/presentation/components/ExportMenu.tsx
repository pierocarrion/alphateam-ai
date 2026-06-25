"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const SCOPES = [
  { value: "team", key: "insights.export.team" as const },
  { value: "productivity", key: "insights.export.productivity" as const },
  { value: "learning", key: "insights.export.learning" as const },
  { value: "wellbeing", key: "insights.export.wellbeing" as const },
  { value: "risks", key: "insights.export.risks" as const },
] as const;

const FORMATS = [
  { value: "csv", label: "CSV", mime: "text/csv" },
  { value: "json", label: "JSON", mime: "application/json" },
] as const;

export function ExportMenu({ days }: { days: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locale] = useLocale();

  const download = async (scope: string, format: string, mime: string) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/team-insights/export?scope=${scope}&format=${format}&days=${days}`
      );
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(
        new Blob([blob], { type: mime })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `team-insights-${scope}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="rounded-button border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-white/[0.03] disabled:opacity-50"
      >
        {busy
          ? t(locale, "insights.export.generating")
          : t(locale, "insights.export.export")}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-card border border-line bg-surface p-2 shadow-xl">
          {SCOPES.map((s) => (
            <div
              key={s.value}
              className="flex items-center justify-between gap-2 rounded-button px-2 py-1.5 hover:bg-white/[0.03]"
            >
              <span className="text-xs text-ink-2">{t(locale, s.key)}</span>
              <div className="flex gap-1">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => download(s.value, f.value, f.mime)}
                    className={cn(
                      "rounded-button px-2 py-0.5 text-[10px] font-semibold uppercase",
                      "bg-accent text-accent-ink"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
