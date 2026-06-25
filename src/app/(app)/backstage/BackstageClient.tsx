"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchJson } from "@/shared/lib/api";
import { Avatar, Button, Icon } from "@/shared/ui";
import type { PersonId } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import { cn } from "@/shared/lib/cn";

type LoadLevel = "low" | "med" | "high";
type BackstageStatus = "In motion" | "New" | "Heavy";

interface BackstageTask {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  category: string;
  app: string;
  load: string;
  status: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  role: string | null;
}

interface LoadMember {
  userId: string;
  name: string;
  openCount: number;
}

interface LoadBalance {
  counts: LoadMember[];
  heavy?: LoadMember;
  imbalanced: boolean;
}

const LOAD_TO_LEVEL: Record<string, LoadLevel> = {
  Light: "low",
  Medium: "med",
  Heavy: "high",
};

const LOAD_COLOR: Record<LoadLevel, string> = {
  low: "var(--color-sage)",
  med: "var(--color-accent)",
  high: "var(--color-glow)",
};

const LOAD_LABEL: Record<LoadLevel, string> = {
  low: "Ligera",
  med: "Media",
  high: "Pesada",
};

const STATUS_COLOR: Record<BackstageStatus, string> = {
  New: "var(--color-accent)",
  "In motion": "var(--color-sage)",
  Heavy: "var(--color-glow)",
};

const STATUS_LABEL: Record<BackstageStatus, string> = {
  New: "Nueva",
  "In motion": "En curso",
  Heavy: "Sobrecargada",
};

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function toDisplay(t: BackstageTask) {
  const level = LOAD_TO_LEVEL[t.load] ?? "low";
  const isNew = Date.now() - new Date(t.createdAt).getTime() < TWO_DAYS_MS;
  const status: BackstageStatus =
    level === "high" ? "Heavy" : isNew ? "New" : "In motion";
  const stress = level === "high" ? 3 : level === "med" ? 2 : 1;
  return { level, status, stress };
}

export function BackstageClient() {
  const [tasks, setTasks] = useState<BackstageTask[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [load, setLoad] = useState<LoadBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchJson<{
        tasks: BackstageTask[];
        loadBalance: LoadBalance;
        members: Member[];
      }>("/api/backstage");
      setTasks(data.tasks);
      setLoad(data.loadBalance);
      setMembers(data.members);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cargar Backstage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const mutate = async (
    id: string,
    body: Record<string, unknown>,
    msg: string
  ) => {
    setBusyId(id);
    try {
      await fetchJson(`/api/backstage/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success(msg);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos actualizar la tarea.");
    } finally {
      setBusyId(null);
    }
  };

  const cats = Array.from(new Set(tasks.map((r) => r.category)));
  const guardian = load?.heavy
    ? {
        who: personIdFromName(load.heavy.name) as PersonId,
        name: load.heavy.name,
        openCount: load.heavy.openCount,
      }
    : null;
  const heavyCount = tasks.filter((t) => (LOAD_TO_LEVEL[t.load] ?? "low") === "high").length;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(110%_50%_at_50%_-10%,#221c2c,var(--color-bg)_60%)]">
      {/* Header */}
      <div className="border-b border-line px-6 py-5 pb-4 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Icon name="shield" size={22} color="var(--color-accent)" />
          <h1 className="font-display text-2xl text-ink">Backstage</h1>
        </div>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          Tu backstage privado. Mira detecta y organiza automáticamente las
          tareas que escucha en el chat del equipo, calculando su carga y nivel
          de estrés para ayudarte a redistribuir el trabajo. <b className="text-ink">Nunca</b>{" "}
          es un marcador público: solo tú lo ves.
        </p>
      </div>

      {/* Guardian banner */}
      {guardian && (
        <div className="mx-6 mt-4 flex flex-col gap-3 rounded-2xl border border-glow bg-gradient-to-b from-glow-soft to-transparent p-4 sm:flex-row sm:items-center sm:gap-3.5 lg:mx-8">
          <Avatar who={guardian.who} size={38} />
          <div className="flex-1">
            <div className="text-[14.5px] font-bold text-ink">
              {guardian.name} tiene {guardian.openCount} tarea
              {guardian.openCount === 1 ? "" : "s"} abierta
              {guardian.openCount === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-ink-3">
              Es quien menos procrastina, así que el trabajo tiende a acumularse.
              Considera redistribuir antes de que afecte al equipo.
            </div>
          </div>
          <Button size="sm" href="/crew" className="shrink-0">
            Ver en Crew
          </Button>
        </div>
      )}

      {/* Summary chips */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pt-4 lg:px-8">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-semibold text-ink-2">
            {tasks.length} tarea{tasks.length === 1 ? "" : "s"} abierta
            {tasks.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-semibold text-ink-2">
            {heavyCount} con carga pesada
          </span>
          {cats.length > 0 && (
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-semibold text-ink-2">
              {cats.length} categorías
            </span>
          )}
        </div>
      )}

      {/* Task cards grouped by category */}
      <div className="flex flex-col gap-5 px-6 py-5 pb-8 lg:px-8">
        {loading ? (
          <p className="text-sm text-ink-3">Cargando tu backstage…</p>
        ) : tasks.length === 0 ? (
          <EmptyBackstage />
        ) : (
          cats.map((cat) => {
            const catRows = tasks.filter((r) => r.category === cat);
            if (!catRows.length) return null;
            return (
              <div key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink">
                    {cat}
                  </span>
                  <span className="text-xs text-ink-3">
                    · {catRows.length} · {catRows[0].app}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {catRows.map((r) => (
                    <BackstageCard
                      key={r.id}
                      task={r}
                      members={members}
                      busy={busyId === r.id}
                      onReassign={(userId) =>
                        mutate(
                          r.id,
                          { userId },
                          `Tarea reasignada a ${
                            members.find((m) => m.id === userId)?.name ?? "el compañero"
                          }.`
                        )
                      }
                      onSetLoad={(lvl) =>
                        mutate(r.id, { load: lvl }, `Carga cambiada a ${lvl}.`)
                      }
                      onSnooze={() => mutate(r.id, { snoozeHours: 24 }, "Tarea pospuesta 24 h.")}
                      onClose={() => mutate(r.id, { close: true }, "Tarea cerrada.")}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BackstageCard({
  task,
  members,
  busy,
  onReassign,
  onSetLoad,
  onSnooze,
  onClose,
}: {
  task: BackstageTask;
  members: Member[];
  busy: boolean;
  onReassign: (userId: string) => void;
  onSetLoad: (lvl: "Light" | "Medium" | "Heavy") => void;
  onSnooze: () => void;
  onClose: () => void;
}) {
  const { level, status, stress } = toDisplay(task);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-2">
      <span className="text-[14.5px] font-semibold leading-snug text-ink">{task.title}</span>

      <div className="flex items-center gap-2">
        <Avatar who={personIdFromName(task.ownerName) as PersonId} size={22} />
        <span className="text-[13px] text-ink-2">{task.ownerName}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold"
          style={{ color: LOAD_COLOR[level] }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: LOAD_COLOR[level] }} />
          {LOAD_LABEL[level]}
        </span>

        <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-3">
          <span className="flex gap-0.5">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className="h-[5px] w-2.5 rounded-[3px]"
                style={{
                  background: n <= stress ? "var(--color-accent)" : "var(--color-line-2)",
                }}
              />
            ))}
          </span>
          Estrés
        </span>

        <span
          className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            color: STATUS_COLOR[status],
            background: `color-mix(in srgb, ${STATUS_COLOR[status]} 12%, transparent)`,
          }}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-bold uppercase tracking-wide text-accent hover:underline disabled:opacity-50"
        >
          {busy ? "…" : expanded ? "Ocultar" : "Acciones"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Reasignar a</span>
            <select
              value={task.ownerId}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value && e.target.value !== task.ownerId) onReassign(e.target.value);
              }}
              className="rounded-xl border border-line-2 bg-bg-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Carga</span>
            <div className="flex gap-1">
              {(["Light", "Medium", "Heavy"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  disabled={busy}
                  onClick={() => onSetLoad(lvl)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50",
                    task.load === lvl
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line-2 text-ink-3 hover:text-ink"
                  )}
                >
                  {LOAD_LABEL[LOAD_TO_LEVEL[lvl]]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onSnooze} disabled={busy}>
              Posponer 24 h
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyBackstage() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line-2 bg-surface px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-2">
        <Icon name="shield" size={24} color="var(--color-ink-3)" />
      </div>
      <div className="max-w-md">
        <p className="text-[15px] font-bold text-ink">Aún no hay tareas en tu backstage</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
          Backstage se alimenta automáticamente cuando Mira detecta acciones en
          el chat del equipo. También aparecen aquí las tareas que crees tú o tu
          equipo en otras vistas. No está roto: simplemente todavía no hay
          tareas abiertas que monitorear.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="ghost" href="/crew">
          Ver equipo en Crew
        </Button>
        <Button size="sm" href="/knowledge">
          Hablar con Mira
        </Button>
      </div>
    </div>
  );
}
