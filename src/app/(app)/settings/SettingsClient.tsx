"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TopBar, SettingsGroup, SettingRow, SettingRowToggle, FeedbackWidget } from "@/shared/ui";
import { GoogleCalendarConnect } from "@/features/calendar/presentation";
import { fetchJson } from "@/shared/lib/api";

interface SettingsClientProps {
  tone: "warm" | "balanced";
  gentleCheckIns: boolean;
  pairStartInvites: boolean;
  quietMode: boolean;
  googleConnected: boolean;
}

interface SettingsState {
  tone: "warm" | "balanced";
  gentleCheckIns: boolean;
  pairStartInvites: boolean;
  quietMode: boolean;
}

export function SettingsClient({
  tone,
  gentleCheckIns,
  pairStartInvites,
  quietMode,
  googleConnected,
}: SettingsClientProps) {
  const [state, setState] = useState<SettingsState>({
    tone,
    gentleCheckIns,
    pairStartInvites,
    quietMode,
  });

  const update = async (patch: Partial<SettingsState>) => {
    const prev = state;
    setState((s) => ({ ...s, ...patch }));
    try {
      await fetchJson("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      setState(prev);
      toast.error(
        err instanceof Error ? err.message : "We couldn’t save that. Please try again."
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar className="lg:hidden" title="Settings" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-5 lg:max-w-3xl lg:mx-auto">
        <SettingsGroup label="Your rhythm">
          <SettingRow title="Intervention" detail="Evenings, ~10:30pm" chevron />
          <SettingRow title="Profile" detail="Bedtime revenge scroll" chevron last />
        </SettingsGroup>

        <SettingsGroup label="Apps conectadas (calendario)">
          <div className="border-b border-line px-4 py-1">
            <GoogleCalendarConnect initialConnected={googleConnected} />
          </div>
          <SettingRow
            title="Acme Deck Hub"
            detail="Conectado"
            tint="var(--color-sage)"
            chevron
            last
          />
        </SettingsGroup>

        <SettingsGroup
          label="Nudges"
          note="Gentle by design. Mira will never alarm, shame, or show what you missed."
        >
          <SettingRowToggle
            title="Gentle check-ins"
            on={state.gentleCheckIns}
            onToggle={() => update({ gentleCheckIns: !state.gentleCheckIns })}
          />
          <SettingRowToggle
            title="Pair-start invites"
            on={state.pairStartInvites}
            onToggle={() => update({ pairStartInvites: !state.pairStartInvites })}
          />
          <SettingRowToggle
            title="Quiet mode (pause all)"
            on={state.quietMode}
            onToggle={() => update({ quietMode: !state.quietMode })}
            last
          />
        </SettingsGroup>

        <SettingsGroup label="Voice">
          <SettingRowToggle
            title="Warm tone"
            on={state.tone === "warm"}
            onToggle={() =>
              update({ tone: state.tone === "warm" ? "balanced" : "warm" })
            }
            last
          />
        </SettingsGroup>

        <SettingsGroup label="Evidence" note="Your wins and struggles help us prove what gentle productivity can do.">
          <div className="p-4">
            <FeedbackWidget />
          </div>
        </SettingsGroup>

        <p className="px-5 pt-1 text-center text-xs text-ink-3 text-wrap-pretty">
          AlphaLead never shows overdue items, broken streaks, or public scores. Promise.
        </p>
      </div>
    </div>
  );
}
