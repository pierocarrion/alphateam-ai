"use client";

import { useState } from "react";
import { TopBar, SettingsGroup, SettingRow, SettingRowToggle, FeedbackWidget } from "@/shared/ui";

interface SettingsClientProps {
  tone: "warm" | "balanced";
}

export function SettingsClient({ tone }: SettingsClientProps) {
  const [nudges, setNudges] = useState(true);
  const [pair, setPair] = useState(true);
  const [quiet, setQuiet] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <TopBar className="lg:hidden" title="Settings" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-5 lg:max-w-3xl lg:mx-auto">
        <SettingsGroup label="Your rhythm">
          <SettingRow title="Intervention" detail="Evenings, ~10:30pm" chevron />
          <SettingRow title="Profile" detail="Bedtime revenge scroll" chevron last />
        </SettingsGroup>

        <SettingsGroup label="Connected apps (knowledge base)">
          <SettingRow title="Acme Deck Hub" detail="Connected" tint="var(--color-sage)" chevron />
          <SettingRow title="Acme Docs" detail="Connected" tint="var(--color-sage)" chevron />
          <SettingRow title="Add an app" plus last />
        </SettingsGroup>

        <SettingsGroup
          label="Nudges"
          note="Gentle by design. Mira will never alarm, shame, or show what you missed."
        >
          <SettingRowToggle
            title="Gentle check-ins"
            on={nudges}
            onToggle={() => setNudges((v) => !v)}
          />
          <SettingRowToggle
            title="Pair-start invites"
            on={pair}
            onToggle={() => setPair((v) => !v)}
          />
          <SettingRowToggle
            title="Quiet mode (pause all)"
            on={quiet}
            onToggle={() => setQuiet((v) => !v)}
            last
          />
        </SettingsGroup>

        <SettingsGroup label="Voice">
          <SettingRow title="Tone" detail={tone === "warm" ? "Warm" : "Balanced"} chevron last />
        </SettingsGroup>

        <SettingsGroup label="Evidence" note="Your wins and struggles help us prove what gentle productivity can do.">
          <div className="p-4">
            <FeedbackWidget />
          </div>
        </SettingsGroup>

        <p className="px-5 pt-1 text-center text-xs text-ink-3 text-wrap-pretty">
          AlphaTeam never shows overdue items, broken streaks, or public scores. Promise.
        </p>
      </div>
    </div>
  );
}
