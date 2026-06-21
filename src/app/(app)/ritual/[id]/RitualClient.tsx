"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Icon, Mira, Overlay, Sparkles } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import { FEELINGS } from "@/features/rituals/lib/feelings";

interface RitualClientProps {
  task: {
    id: string;
    title: string;
    micro: string;
    action: string;
    resource: string;
    selfMade: boolean;
  };
  warm: boolean;
}

export function RitualClient({ task, warm }: RitualClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<"unlock" | "focus" | "reward">("unlock");
  const [feelingId, setFeelingId] = useState<string | null>(null);
  const [ritualId, setRitualId] = useState<string | null>(null);
  const [recoveredMinutes, setRecoveredMinutes] = useState<number | null>(null);

  const handleStartFocus = async (selectedFeelingId: string) => {
    try {
      const data = await fetchJson<{ ritual: { id: string } }>("/api/rituals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          feeling: selectedFeelingId,
          durationSec: 120,
        }),
      });
      setRitualId(data.ritual.id);
      setStep("focus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't start the ritual. Please try again.");
    }
  };

  const handleComplete = async () => {
    if (ritualId) {
      try {
        const data = await fetchJson<{ recoveredMinutes?: number }>(
          `/api/rituals/${ritualId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: true }),
          }
        );
        if (typeof data.recoveredMinutes === "number") {
          setRecoveredMinutes(data.recoveredMinutes);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "We couldn't save your progress. Please try again.");
      }
    }
    setStep("reward");
  };

  return (
    <Overlay>
      {step === "unlock" && (
        <UnlockStep
          task={task}
          warm={warm}
          feelingId={feelingId}
          setFeelingId={setFeelingId}
          onClose={() => router.push("/home")}
          onStartFocus={handleStartFocus}
        />
      )}
      {step === "focus" && (
        <FocusStep
          task={task}
          warm={warm}
          onDone={handleComplete}
          onClose={() => router.push("/home")}
        />
      )}
      {step === "reward" && (
        <RewardStep
          warm={warm}
          recoveredMinutes={recoveredMinutes}
          onHome={() => router.push("/home")}
        />
      )}
    </Overlay>
  );
}

function UnlockStep({
  task,
  warm,
  feelingId,
  setFeelingId,
  onClose,
  onStartFocus,
}: {
  task: RitualClientProps["task"];
  warm: boolean;
  feelingId: string | null;
  setFeelingId: (id: string) => void;
  onClose: () => void;
  onStartFocus: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const selected = FEELINGS.find((f) => f.id === feelingId);

  return (
    <div className="flex h-full flex-col">
      <div className="h-[58px] flex-none" />
      <div className="flex flex-none items-center gap-3 px-5 pb-1.5 pt-1">
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-white/[0.04]"
        >
          <Icon name="close" size={21} color="var(--color-ink-2)" />
        </button>
        <div className="flex flex-1 justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i <= step ? 20 : 8,
                background:
                  i <= step ? "var(--color-accent)" : "var(--color-line-2)",
              }}
            />
          ))}
        </div>
        <span className="w-16 text-right text-xs text-ink-3">2‑min unlock</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 scrollbar-hide">
        {step === 0 && (
          <div className="flex h-full flex-col justify-center py-4">
            <div className="mb-5 text-center">
              <Mira size={72} mood="calm" className="mx-auto mb-4" />
              <h1 className="font-display text-[28px] leading-tight text-ink">
                Before we start…
              </h1>
              <p className="mx-auto mt-2 max-w-[260px] text-[15px] leading-snug text-ink-2">
                What comes up when you picture the launch deck?
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {FEELINGS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setFeelingId(opt.id);
                    setTimeout(() => setStep(1), 240);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-2"
                  style={{
                    borderColor:
                      feelingId === opt.id ? "var(--color-accent)" : undefined,
                  }}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="flex-1 text-[16px] font-semibold text-ink">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-ink-3">
              There’s no wrong answer. Mira won’t share this.
            </p>
          </div>
        )}

        {step === 1 && selected && (
          <div className="flex h-full flex-col justify-center py-4 text-center">
            <Mira size={80} mood="happy" ring className="mx-auto mb-5" />
            <div
              className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-xs font-bold text-glow"
              style={{ background: "var(--color-glow-soft)" }}
            >
              <span>{selected.emoji}</span>
              {selected.label}
            </div>
            <h1
              className="mx-auto max-w-[300px] font-display text-[25px] leading-snug text-ink"
              style={{ lineHeight: 1.3 }}
            >
              {selected.val}
            </h1>
            <div className="mt-8">
              <Button full icon="arrow" onClick={() => setStep(2)}>
                I’m ready
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex h-full flex-col justify-center py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              We’re not doing this
            </p>
            <div
              className="mx-auto mb-2 mt-2 max-w-[290px] border border-dashed border-line-2 p-3 text-[16px] text-ink-3"
              style={{ borderRadius: 16, textDecoration: "line-through" }}
            >
              {task.title} — the whole thing
            </div>
            <div className="my-3 flex justify-center">
              <div style={{ transform: "rotate(90deg)" }}>
                <Icon name="arrow" size={22} color="var(--color-accent)" />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              We’re doing this
            </p>
            <div
              className="mt-3 rounded-[26px] border border-accent p-6 text-center"
              style={{
                background:
                  "linear-gradient(180deg, var(--color-accent-soft), transparent)",
              }}
            >
              <Mira size={56} mood="happy" className="mx-auto mb-4" />
              <div
                className="font-display text-[24px] leading-snug text-ink"
                style={{ lineHeight: 1.3 }}
              >
                {task.micro}
              </div>
              <p className="mx-auto mt-3 max-w-[260px] text-[15px] leading-snug text-ink-2">
                That’s the entire ask. You’re allowed to stop right after —
                really.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2.5">
                <Icon name="doc" size={16} color="var(--color-accent)" />
                <span className="text-sm font-semibold text-ink">
                  {task.resource}
                </span>
                <span className="text-xs text-ink-3">· linked</span>
              </div>
            </div>
            <div className="mt-6">
              <Button
                full
                icon="play"
                onClick={() => feelingId && onStartFocus(feelingId)}
              >
                Open it with me
              </Button>
              <p className="mt-3 text-center text-xs text-ink-3">
                {warm
                  ? "I’ll sit with you the whole time. No timer pressure."
                  : "No countdown pressure. Stop anytime."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FocusStep({
  task,
  warm,
  onDone,
  onClose,
}: {
  task: RitualClientProps["task"];
  warm: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const TOTAL = 120;
  const [left, setLeft] = useState(TOTAL);
  const [paused, setPaused] = useState(false);
  const tick = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paused) return;
    tick.current = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          if (tick.current) clearInterval(tick.current);
          setTimeout(onDone, 400);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [paused, onDone]);

  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");
  const prog = 1 - left / TOTAL;
  const R = 86;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="h-[58px] flex-none" />
      <div className="flex flex-none justify-end px-5 pt-2">
        <button
          onClick={onClose}
          className="text-[15px] font-semibold text-ink-3 transition-colors hover:text-ink-2"
        >
          I’ll come back
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
          {task.action}
        </p>
        <h1 className="mb-7 font-display text-[28px] leading-tight text-ink">
          You’re in it now.
        </h1>

        <div
          className="relative flex items-center justify-center"
          style={{ width: 220, height: 220 }}
        >
          <svg
            width="220"
            height="220"
            className="absolute"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke="var(--color-line-2)"
              strokeWidth="3"
            />
            <circle
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - prog)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <Mira size={132} mood="calm" ring />
        </div>

        <div
          className="mt-6 font-display text-[34px] tracking-wide text-ink"
          style={{ letterSpacing: "0.02em" }}
        >
          {mm}:{ss}
        </div>
        <p className="mx-auto mt-2 max-w-[260px] text-[15px] leading-snug text-ink-2">
          {paused
            ? "Paused. Stopping is fine — you still showed up."
            : warm
            ? "I’m right here with you. Take your time."
            : "Just keep going. The timer isn’t a deadline."}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-2">
        <Button full icon="check" onClick={onDone}>
          {task.selfMade ? "I did the first bit" : "I did the messy sentence"}
        </Button>
        <Button variant="ghost" full onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume" : "Pause — no pressure"}
        </Button>
      </div>
    </div>
  );
}

function RewardStep({
  warm,
  recoveredMinutes,
  onHome,
}: {
  warm: boolean;
  recoveredMinutes: number | null;
  onHome: () => void;
}) {
  const [boom, setBoom] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBoom(true), 220);
    return () => clearTimeout(t);
  }, []);

  const minutes = recoveredMinutes ?? 14;

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="h-[58px] flex-none" />
      <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
        <div className="relative mb-6">
          {boom && <Sparkles n={20} />}
          <Mira size={104} mood="cheer" />
        </div>

        <h1 className="font-display text-[32px] text-ink">You did it.</h1>
        <p className="mx-auto mt-3 max-w-[290px] text-[15px] leading-snug text-ink-2">
          {warm
            ? "That counts — fully. The hardest part was starting, and you just did. The rest is easier from here."
            : "That counts. Starting was the hard part, and it’s done."}
        </p>

        <div className="mt-6 flex w-full max-w-[300px] items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 text-left">
          <div
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px]"
            style={{ background: "var(--color-sage-soft)" }}
          >
            <Icon name="leaf" size={22} color="var(--color-sage)" />
          </div>
          <div>
            <div className="text-[15.5px] font-bold text-ink">
              ~{minutes} minute{minutes === 1 ? "" : "s"} recovered
            </div>
            <div className="text-xs text-ink-3">
              Time you’d have spent circling it. Yours again.
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5 pb-5 pt-2">
        <Button full onClick={onHome}>
          Back to my day
        </Button>
        <Button variant="quiet" full onClick={onHome}>
          Keep the momentum — one more later
        </Button>
      </div>
    </div>
  );
}
