"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { useProjectSettings } from "@/features/project-settings/presentation/hooks";
import { SmartGoalEditor } from "@/features/project-settings/presentation/components/SmartGoalEditor";
import { TeamManager } from "@/features/project-settings/presentation/components/TeamManager";
import { KpiChips } from "@/features/project-settings/presentation/components/KpiChips";
import { AiInsightsPanel } from "@/features/project-settings/presentation/components/AiInsightsPanel";
import { Spinner } from "@/features/project-settings/presentation/components/primitives";

type Tab = "smart" | "team" | "kpis" | "ai";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "smart", label: "Objetivo SMART", icon: "🎯" },
  { id: "team", label: "Equipo", icon: "👥" },
  { id: "kpis", label: "KPIs", icon: "📊" },
  { id: "ai", label: "IA", icon: "✨" },
];

export function ProjectSettingsModule({
  workspaceId,
  workspaceName,
  workspaceEmoji,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceEmoji: string | null;
}) {
  const [tab, setTab] = useState<Tab>("smart");
  const settings = useProjectSettings(workspaceId);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
            Coordinación
          </div>
          <h1 className="mt-1 font-display text-2xl text-ink">
            Configuración del proyecto
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-2">
            {workspaceEmoji ?? "🚀"} {workspaceName} · parámetros estratégicos y operativos
            para el motor de IA.
          </p>
        </div>

        <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-[13.5px] font-semibold transition-colors",
                tab === t.id
                  ? "bg-accent-soft text-ink"
                  : "text-ink-3 hover:bg-surface-2 hover:text-ink-2"
              )}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {settings.isLoading ? (
          <Spinner label="Cargando configuración…" />
        ) : settings.isError ? (
          <div className="rounded-2xl border border-glow-soft bg-glow-soft/30 p-5 text-sm text-ink-2">
            No pudimos cargar la configuración. Revisa tu conexión e inténtalo de nuevo.
          </div>
        ) : settings.data ? (
          <div className="flex flex-col gap-5">
            {tab === "smart" && (
              <SmartGoalEditor
                key={settings.data.smartGoal?.updatedAt ?? "new"}
                workspaceId={workspaceId}
                smartGoal={settings.data.smartGoal}
              />
            )}
            {tab === "team" && (
              <TeamManager
                workspaceId={workspaceId}
                members={settings.data.members}
                invitations={settings.data.invitations}
              />
            )}
            {tab === "kpis" && (
              <KpiChips workspaceId={workspaceId} kpis={settings.data.kpis} />
            )}
            {tab === "ai" && (
              <AiInsightsPanel
                workspaceId={workspaceId}
                insights={settings.data.insights}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
