"use client";

import { useState } from "react";
import { Alpha, TopBar } from "@/shared/ui";
import { GoalProgressTracker } from "@/features/projects/presentation/components/GoalProgressTracker";

interface ProgressClientProps {
  warm: boolean;
  projectName: string;
  projectEmoji: string | null;
  goals: Array<{
    id: string;
    title: string;
    status: string;
    deadline: string | null;
  }>;
  initialGoalId: string | null;
}

/**
 * Client shell for the leader Progress section. Lets the leader switch between
 * the project's SMART goals and renders the live progress tracker for the
 * selected goal.
 */
export function ProgressClient({
  warm,
  projectName,
  projectEmoji,
  goals,
  initialGoalId,
}: ProgressClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialGoalId);
  const selected = goals.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        className="lg:hidden"
        kicker="Coordinación"
        title="Progreso"
        trailing={<Alpha size={28} mood="calm" />}
      />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-6 pt-2 lg:max-w-3xl lg:mx-auto lg:pt-6">
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
            {projectEmoji ? `${projectEmoji} ` : ""}
            {projectName}
          </p>
          <h1 className="mt-0.5 font-display text-[26px] text-ink">
            Progreso del objetivo
          </h1>
        </div>

        {goals.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {goals.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  g.id === selectedId
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface-2 text-ink-2 hover:bg-surface-3"
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          {selected ? (
            <GoalProgressTracker
              goalId={selected.id}
              goalTitle={selected.title}
              warm={warm}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card mt-2 flex flex-col items-center gap-3 p-8 text-center">
      <Alpha size={40} mood="thinking" />
      <p className="text-sm text-ink-2">
        Aún no hay un objetivo SMART en este proyecto.
      </p>
      <p className="max-w-sm text-xs text-ink-3 text-wrap-pretty">
        Crea un objetivo con métrica, responsable y fecha límite desde el asistente
        de proyecto, y aquí verás su avance en tiempo real.
      </p>
    </div>
  );
}
