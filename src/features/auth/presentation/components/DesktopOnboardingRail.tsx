"use client";

import { Alpha } from "@/shared/ui";
import type { AlphaMood } from "@/shared/ui/Alpha";

interface RailProfile {
  id: string;
  name: string;
}

interface DesktopOnboardingRailProps {
  step: number;
  role: string | null;
  hard: string | null;
  profile: RailProfile | null;
  className?: string;
}

const STEPS = [
  { key: "role", label: "Your role" },
  { key: "moment", label: "Hard moment" },
  { key: "pattern", label: "Your pattern" },
  { key: "setup", label: "How I'll show up" },
];

const STEP_MOODS: AlphaMood[] = ["happy", "calm", "thinking", "happy"];

const TAGLINES = [
  "Let's get to know each other — quietly, no pressure.",
  "I'll meet you at the moment that matters most.",
  "Honest answers make a gentler plan.",
  "Here's how I'll show up for you.",
];

export function DesktopOnboardingRail({
  step,
  role,
  hard,
  profile,
  className,
}: DesktopOnboardingRailProps) {
  const mood = STEP_MOODS[step] ?? "calm";
  const tagline = TAGLINES[step] ?? "";

  return (
    <aside
      data-testid="onboarding-rail"
      className={className}
      aria-label="Onboarding progress"
    >
      <div className="relative flex h-full flex-col justify-between overflow-hidden px-8 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_60%_at_50%_-10%,#221c2c,var(--color-bg)_60%)]" />

        <div className="flex flex-col items-start gap-5">
          <div className="flex items-center gap-3">
            <Alpha size={72} mood={mood} ring />
            <div className="flex flex-col">
              <span className="font-display text-2xl tracking-tight text-ink">
                Alpha
              </span>
              <span className="text-xs text-ink-3">
                Your gentle teammate
              </span>
            </div>
          </div>
          <p className="max-w-[260px] text-[15px] leading-relaxed text-ink-2">
            {tagline}
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const roleLabel =
              s.key === "role" && role
                ? role
                : s.key === "moment" && hard
                  ? hard
                  : s.key === "pattern" && profile
                    ? profile.name
                    : null;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 transition-colors ${
                  active
                    ? "border-accent bg-accent-soft"
                    : done
                      ? "border-line-2 bg-white/[0.02]"
                      : "border-transparent"
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? "bg-accent text-accent-ink"
                      : active
                        ? "bg-accent-soft text-accent"
                        : "bg-surface-2 text-ink-3"
                  }`}
                  aria-hidden
                >
                  {done ? "✓" : i + 1}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span
                    className={`text-[13px] font-semibold ${
                      active || done ? "text-ink" : "text-ink-3"
                    }`}
                  >
                    {s.label}
                  </span>
                  {roleLabel && (
                    <span className="truncate text-xs text-ink-3">
                      {roleLabel}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-xs text-ink-3">
          No alarms, ever. You can change any of this later in Settings.
        </p>
      </div>
    </aside>
  );
}
