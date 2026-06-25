"use client";

import { useLocale } from "./useLocale";
import type { Locale } from "./messages";

const OPTIONS: Array<{ code: Locale; label: string }> = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

interface LanguageToggleProps {
  className?: string;
  locale?: Locale;
  onChange?: (next: Locale) => void;
}

/**
 * Compact ES/EN language toggle. Sets a cookie and refreshes so the chosen
 * locale is applied to the page strings. Can be used uncontrolled (reads its
 * own state) or controlled by passing `locale` + `onChange` so the parent stays
 * in sync with the selected language.
 */
export function LanguageToggle({ className = "", locale, onChange }: LanguageToggleProps) {
  const [internalLocale, setInternalLocale] = useLocale();
  const current = locale ?? internalLocale;

  const handleSelect = (next: Locale) => {
    if (onChange) {
      onChange(next);
      return;
    }
    setInternalLocale(next);
  };
  return (
    <div
      className={`inline-flex items-center rounded-full border border-line bg-surface p-0.5 ${className}`}
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((opt) => {
        const active = opt.code === current;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => handleSelect(opt.code)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors ${
              active
                ? "bg-accent text-bg"
                : "text-ink-3 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
