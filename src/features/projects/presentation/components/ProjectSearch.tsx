"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mira, Button, Card } from "@/shared/ui";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { normalizeHashtag } from "@/features/projects/domain/hashtag";

interface ProjectSummary {
  id: string;
  name: string;
  hashtag: string;
  emoji: string | null;
  description: string | null;
  industry: string | null;
  category: string | null;
  memberCount: number;
  leaderName: string | null;
}

interface MyRequest {
  id: string;
  status: string;
  workspace: {
    id: string;
    name: string;
    hashtag: string;
    emoji: string | null;
  };
}

export function ProjectSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    refreshRequests();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchJson<{ projects: ProjectSummary[] }>(
          `/api/projects?q=${encodeURIComponent(q)}`
        );
        if (active) setResults(res.projects);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [debounced]);

  async function refreshRequests() {
    try {
      const res = await fetchJson<{ requests: MyRequest[] }>(
        "/api/projects/my-requests"
      );
      setMyRequests(res.requests);
    } catch {
      // ignore
    }
  }

  const requestedHashtags = new Set(
    myRequests
      .filter((r) => r.status === "pending" || r.status === "approved")
      .map((r) => r.workspace.hashtag)
  );

  const requestJoin = async (project: ProjectSummary) => {
    setPendingId(project.id);
    try {
      await fetchJson("/api/projects/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashtag: normalizeHashtag(project.hashtag),
          message: message[project.id]?.trim() || undefined,
        }),
      });
      toast.success(`Solicitud enviada a ${project.name}`);
      await refreshRequests();
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "No pudimos enviar la solicitud.";
      toast.error(msg);
    } finally {
      setPendingId(null);
    }
  };

  const approved = myRequests.find((r) => r.status === "approved");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-6 lg:max-w-2xl lg:mx-auto lg:w-full">
        <div className="mb-5 flex items-center gap-3 pt-1">
          <Mira size={44} mood="thinking" />
          <div>
            <div className="text-xs text-ink-3">Encuentra tu proyecto</div>
            <div className="font-display text-[22px] text-ink">
              ¿A dónde te unes?
            </div>
          </div>
        </div>

        {approved && (
          <Card className="mb-4 flex items-center gap-3 border-sage bg-surface">
            <span className="text-xl">🎉</span>
            <div className="flex-1">
              <p className="text-[14.5px] font-bold text-ink">
                Fuiste aceptado en {approved.workspace.name}
              </p>
              <p className="text-xs text-ink-3">¡Ya eres parte del equipo!</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                router.push("/home");
                router.refresh();
              }}
            >
              Entrar
            </Button>
          </Card>
        )}

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por nombre o hashtag (ej. q3-launch)"
          className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />

        {loading && (
          <p className="mt-4 text-sm text-ink-3">Buscando…</p>
        )}

        {!loading && debounced.trim() && results.length === 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-[15px] text-ink-2">
              No encontramos proyectos para “{debounced}”.
            </p>
            <p className="mt-1 text-xs text-ink-3">
              Pide el hashtag exacto a tu líder.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {results.map((p) => {
            const requested = requestedHashtags.has(p.hashtag);
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-surface-2 text-xl">
                    {p.emoji ?? "🚀"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[17px] text-ink">
                        {p.name}
                      </span>
                      <span className="font-mono text-xs text-ink-3">
                        {p.hashtag}
                      </span>
                    </div>
                    {p.description && (
                      <p className="mt-0.5 text-sm text-ink-2 line-clamp-2">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-3">
                      {p.industry && <span>· {p.industry}</span>}
                      {p.category && <span>· {p.category}</span>}
                      <span>· {p.memberCount} miembro(s)</span>
                      {p.leaderName && <span>· lidera {p.leaderName}</span>}
                    </div>
                  </div>
                </div>

                {!requested && (
                  <input
                    type="text"
                    value={message[p.id] ?? ""}
                    onChange={(e) =>
                      setMessage((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    placeholder="Mensaje opcional para el líder…"
                    maxLength={280}
                    className="w-full rounded-xl border border-line-2 bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                  />
                )}

                <div>
                  {requested ? (
                    <div className="w-full rounded-button bg-surface-2 px-4 py-2.5 text-center text-sm font-semibold text-ink-3">
                      Solicitud enviada · esperando al líder
                    </div>
                  ) : (
                    <Button
                      full
                      size="sm"
                      disabled={pendingId === p.id}
                      onClick={() => requestJoin(p)}
                    >
                      {pendingId === p.id ? "Enviando…" : "Solicitar unirme"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {!debounced.trim() && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm text-ink-2">
              Escribe el nombre o hashtag de tu proyecto. Tu líder te dará el
              hashtag exacto (como <span className="font-mono">#q3-launch</span>).
            </p>
          </div>
        )}

        {myRequests.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              Mis solicitudes
            </p>
            <div className="space-y-2">
              {myRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                >
                  <span className="text-lg">{r.workspace.emoji ?? "🚀"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {r.workspace.name}
                    </p>
                    <p className="font-mono text-xs text-ink-3">
                      {r.workspace.hashtag}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      r.status === "approved"
                        ? "bg-sage/20 text-sage"
                        : r.status === "rejected"
                          ? "bg-glow/20 text-glow"
                          : "bg-accent-soft text-accent"
                    }`}
                  >
                    {r.status === "approved"
                      ? "Aceptada"
                      : r.status === "rejected"
                        ? "Rechazada"
                        : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
