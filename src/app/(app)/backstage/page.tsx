import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { computeLoadBalance } from "@/server/lib/metrics";
import { personIdFromName } from "@/shared/lib/person";
import { Avatar, Button, Icon } from "@/shared/ui";
import type { PersonId } from "@/shared/ui";

type LoadLevel = "low" | "med" | "high";
type BackstageStatus = "In motion" | "New" | "Heavy";

interface BackstageTask {
  id: string;
  title: string;
  who: PersonId;
  owner: string;
  category: string;
  app: string;
  load: LoadLevel;
  stress: number;
  status: BackstageStatus;
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

function toBackstageTask(t: {
  id: string;
  title: string;
  category: string;
  app: string;
  load: string;
  status: string;
  createdAt: Date;
  user: { name: string | null };
}): BackstageTask {
  const level = LOAD_TO_LEVEL[t.load] ?? "low";
  const isNew = Date.now() - t.createdAt.getTime() < TWO_DAYS_MS;
  const status: BackstageStatus =
    level === "high" ? "Heavy" : isNew ? "New" : "In motion";
  return {
    id: t.id,
    title: t.title,
    who: personIdFromName(t.user.name ?? "Someone") as PersonId,
    owner: t.user.name ?? "Someone",
    category: t.category,
    app: t.app,
    load: level,
    stress: level === "high" ? 3 : level === "med" ? 2 : 1,
    status,
  };
}

export default async function BackstagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (
    !active ||
    (active.role !== "leader" && active.role !== "admin")
  ) {
    redirect("/home");
  }

  const workspaceId = active.workspaceId;

  const [tasks, load] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: "open",
        user: { memberships: { some: { workspaceId } } },
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    computeLoadBalance(workspaceId),
  ]);

  const rows = tasks.map(toBackstageTask);
  const cats = Array.from(new Set(rows.map((r) => r.category)));
  const guardian = load.heavy
    ? {
        who: personIdFromName(load.heavy.name) as PersonId,
        name: load.heavy.name,
        openCount: load.heavy.openCount,
      }
    : null;

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
            Sugerir redistribución
          </Button>
        </div>
      )}

      {/* Summary chips */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pt-4 lg:px-8">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-semibold text-ink-2">
            {rows.length} tarea{rows.length === 1 ? "" : "s"} abierta
            {rows.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-semibold text-ink-2">
            {rows.filter((r) => r.load === "high").length} con carga pesada
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
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
            <Icon name="check" size={30} color="var(--color-sage)" />
            <p className="max-w-sm text-[15px] text-ink-2">
              No hay tareas abiertas ahora mismo. El equipo está al día.
            </p>
          </div>
        ) : (
          cats.map((cat) => {
            const catRows = rows.filter((r) => r.category === cat);
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
                    <div
                      key={r.id}
                      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-2"
                    >
                      <span className="text-[14.5px] font-semibold leading-snug text-ink">
                        {r.title}
                      </span>

                      <div className="flex items-center gap-2">
                        <Avatar who={r.who} size={22} />
                        <span className="text-[13px] text-ink-2">{r.owner}</span>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: LOAD_COLOR[r.load] }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: LOAD_COLOR[r.load] }}
                          />
                          {LOAD_LABEL[r.load]}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-3">
                          <span className="flex gap-0.5">
                            {[1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className="h-[5px] w-2.5 rounded-[3px]"
                                style={{
                                  background:
                                    n <= r.stress
                                      ? "var(--color-accent)"
                                      : "var(--color-line-2)",
                                }}
                              />
                            ))}
                          </span>
                          Estrés
                        </span>

                        <span
                          className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={{
                            color: STATUS_COLOR[r.status],
                            background: `color-mix(in srgb, ${STATUS_COLOR[r.status]} 12%, transparent)`,
                          }}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                    </div>
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
