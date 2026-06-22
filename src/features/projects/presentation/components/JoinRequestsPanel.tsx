"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mira, Button, Card, Avatar } from "@/shared/ui";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { personIdFromName } from "@/shared/lib/person";
import type { PersonId } from "@/shared/ui";

interface PendingRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

export function JoinRequestsPanel() {
  const router = useRouter();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<{ requests: PendingRequest[] }>(
        "/api/projects/requests"
      );
      setRequests(res.requests);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos cargar las solicitudes.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchJson<{ requests: PendingRequest[] }>(
          "/api/projects/requests"
        );
        if (active) setRequests(res.requests);
      } catch (err) {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.message
            : "No pudimos cargar las solicitudes.";
        toast.error(msg);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setActing(id);
    try {
      await fetchJson(`/api/projects/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      toast.success(
        decision === "approved"
          ? "Solicitud aceptada. Ya es parte del equipo."
          : "Solicitud rechazada."
      );
      await load();
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "No pudimos responder a la solicitud.";
      toast.error(msg);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-6 lg:max-w-2xl lg:mx-auto lg:w-full">
        <div className="mb-5 flex items-center gap-3 pt-1">
          <Mira size={44} mood="happy" />
          <div>
            <div className="text-xs text-ink-3">Solicitudes de ingreso</div>
            <div className="font-display text-[22px] text-ink">Tu equipo</div>
          </div>
        </div>

        {loading && <p className="text-sm text-ink-3">Cargando…</p>}

        {!loading && requests.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[15px] text-ink-2">
              No hay solicitudes pendientes.
            </p>
            <p className="mt-1 text-xs text-ink-3">
              Comparte el hashtag de tu proyecto para que tu equipo te pida
              unirse.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {requests.map((r) => {
            const who = personIdFromName(r.userName ?? "Someone") as PersonId;
            return (
              <Card key={r.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar who={who} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-ink">
                      {r.userName ?? "Alguien"}
                    </p>
                    <p className="truncate text-xs text-ink-3">
                      {r.userEmail ?? ""}
                    </p>
                  </div>
                </div>
                {r.message && (
                  <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
                    “{r.message}”
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    full
                    disabled={acting === r.id}
                    onClick={() => decide(r.id, "approved")}
                  >
                    Aceptar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    full
                    disabled={acting === r.id}
                    onClick={() => decide(r.id, "rejected")}
                  >
                    Rechazar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
