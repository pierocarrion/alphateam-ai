"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Alpha, Button } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";

interface NightClientProps {
  warm: boolean;
  name: string;
  windDownsThisWeek: number;
}

export function NightClient({ warm, name, windDownsThisWeek }: NightClientProps) {
  const [stage, setStage] = useState(0);
  const savedRef = useRef(false);

  useEffect(() => {
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), 8200);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === 2 && !savedRef.current) {
      savedRef.current = true;
      fetchJson("/api/winddown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {
        toast.error("We couldn’t save your wind-down. That’s okay — it still counted.");
      });
    }
  }, [stage]);

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 30%, #1b1a28 0%, #100f17 60%, #0a0910 100%)",
      }}
    >
      <div className="h-[58px] flex-none" />
      {stage !== 1 && (
        <div className="flex flex-none justify-end px-[18px]">
          <Button variant="quiet" href="/home">Close</Button>
        </div>
      )}

      {/* Stage 0 — invitation */}
      {stage === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
          <Alpha size={84} mood="calm" className="mb-6" />
          <p className="fade text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "#9FB8E0" }}>
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
          <h1 className="rise mt-3 font-display text-[30px] leading-tight text-ink text-wrap-pretty">
            The scroll can wait.
          </h1>
          <p className="lead rise mt-3.5 max-w-[280px] text-ink-2">
            {warm
              ? "You don’t owe the day anything more. Let’s set it down softly, together."
              : "Nothing left to do tonight. Let’s wind down."}
          </p>
          <div className="card rise mt-6 max-w-[300px] p-4">
            <p className="text-xs text-ink-3 text-wrap-pretty">
              {windDownsThisWeek > 0
                ? `You’ve wound down ${windDownsThisWeek} time${windDownsThisWeek === 1 ? "" : "s"} this week. Your sleep thanks you.`
                : "The late scroll quietly costs most people ~332 hours of sleep a year. You don’t have to spend yours tonight."}
            </p>
          </div>
          <div className="mt-7 w-full max-w-[320px]">
            <Button full size="lg" icon="moon" onClick={() => setStage(1)}>
              Breathe, then set it down
            </Button>
          </div>
        </div>
      )}

      {/* Stage 1 — breathing */}
      {stage === 1 && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
          <div className="relative mb-9 flex h-[200px] w-[200px] items-center justify-center">
            <div className="breathe-halo" />
            <Alpha size={96} mood="calm" />
          </div>
          <h1 className="h1 breathe-word">Breathe in…</h1>
          <p className="body mt-2.5 text-ink-2">Follow the glow. Four slow rounds.</p>
        </div>
      )}

      {/* Stage 2 — goodnight */}
      {stage === 2 && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 text-center">
          <Alpha size={64} mood="happy" className="mb-6 opacity-90" />
          <h1 className="h1 rise">Goodnight, {name}.</h1>
          <p className="lead rise mt-3 max-w-[260px] text-ink-2">
            I’ll be here in the morning. Rest is the most productive thing you’ll do tonight.
          </p>
          <Button variant="quiet" href="/home" className="rise mt-8">
            Set the phone down
          </Button>
        </div>
      )}
    </div>
  );
}
