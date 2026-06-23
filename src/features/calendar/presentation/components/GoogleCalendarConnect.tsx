"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Icon } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";

interface GoogleCalendarConnectProps {
  initialConnected: boolean;
  callbackUrl?: string;
}

/**
 * Lets the signed-in user connect or disconnect their Google Calendar.
 * Connecting sets a short-lived link cookie and starts the Google OAuth flow
 * (NextAuth), which stores refreshable tokens on the user's account.
 */
export function GoogleCalendarConnect({
  initialConnected,
  callbackUrl = "/settings",
}: GoogleCalendarConnectProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      await fetchJson("/api/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl }),
      });
      await signIn("google", { callbackUrl });
    } catch (err) {
      setBusy(false);
      toast.error(
        err instanceof Error ? err.message : "No pudimos iniciar la conexión con Google."
      );
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetchJson("/api/calendar/disconnect", { method: "DELETE" });
      setConnected(false);
      toast.success("Desconectamos tu Google Calendar.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos desconectar el calendario."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={connected ? disconnect : connect}
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] ${
        connected ? "" : ""
      }`}
    >
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-surface-2">
        <Icon name="clock" size={17} color="var(--color-ink-2)" />
      </div>
      <span className="flex-1 text-left text-[15.5px] text-ink">
        Google Calendar
      </span>
      <span
        className="text-xs font-semibold"
        style={{
          color: connected ? "var(--color-sage)" : "var(--color-ink-3)",
        }}
      >
        {busy ? "…" : connected ? "Conectado" : "Conectar"}
      </span>
    </button>
  );
}
