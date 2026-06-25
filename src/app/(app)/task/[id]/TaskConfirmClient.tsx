"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Icon, Mira, Overlay, TopBar, Avatar } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";

interface TaskConfirmClientProps {
  task: {
    id: string;
    title: string;
    fromQuote: string;
    category: string;
    app: string;
    due: string;
    micro: string;
    resource: string;
    selfMade: boolean;
  };
  warm: boolean;
}

export function TaskConfirmClient({ task, warm }: TaskConfirmClientProps) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);

  const handleDiscard = async () => {
    if (discarding) return;
    setDiscarding(true);
    try {
      await fetchJson(`/api/tasks/${task.id}`, { method: "DELETE" });
      router.push("/chat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't remove that task. Please try again.");
      setDiscarding(false);
    }
  };

  const handleStart = () => {
    router.push(`/ritual/${task.id}`);
  };

  return (
    <Overlay>
      <div className="flex h-full flex-col">
        <div className="h-[58px] flex-none" />
        <TopBar
          kicker="Mira noticed"
          title="Is this yours?"
          trailing={
            <button
              onClick={() => router.push("/chat")}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white/[0.04]"
            >
              <Icon name="close" size={21} color="var(--color-ink-2)" />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide">
          <div className="flex flex-col gap-3.5 pt-1">
            <div
              className="flex items-center gap-3 border border-line bg-surface p-4"
              style={{ borderRadius: 16 }}
            >
              {!task.selfMade && <Avatar who="daniel" size={40} />}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-ink-3">
                  {task.selfMade ? "You mentioned" : "Daniel asked, gently"}
                </div>
                <div className="mt-0.5 text-[15px] text-ink">
                  {task.fromQuote}
                </div>
              </div>
              {!task.selfMade && <Icon name="arrow" size={18} color="var(--color-ink-3)" />}
              <Avatar who="maya" size={40} />
            </div>

            <div className="rounded-2xl border border-line bg-surface p-[18px]">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                What Mira heard
              </div>
              <div className="font-display text-[22px] leading-tight text-ink">
                {task.title}
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  <Icon name="doc" size={14} color="var(--color-glow)" />
                  {task.category}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  <Icon name="link" size={14} color="var(--color-glow)" />
                  {task.app}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  <Icon name="clock" size={14} color="var(--color-ink-3)" />
                  {task.due}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-3">
                Filed under{" "}
                <b className="text-ink-2">{task.category}</b> automatically —
                you don’t have to sort anything.
              </p>
            </div>

            <div
              className="rounded-3xl border border-accent p-[18px]"
              style={{
                background:
                  "linear-gradient(180deg, var(--color-accent-soft), transparent)",
              }}
            >
              <div className="flex items-start gap-3">
                <Mira size={34} mood="happy" />
                <div className="flex-1">
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-accent">
                    Your first step, already tiny
                  </div>
                  <div className="text-[17px] font-semibold leading-snug text-ink">
                    {task.micro}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <Icon name="link" size={15} color="var(--color-ink-3)" />
                    <span className="text-xs text-ink-2">
                      {task.resource} — ready to open
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="px-4 py-1 text-center text-xs leading-relaxed text-ink-3">
              {warm
                ? "Nothing’s scheduled, nothing’s assigned. You’re just deciding if it’s yours."
                : "Nothing is scheduled until you say so."}
            </p>
          </div>
        </div>

        <div className="flex-none px-5 pb-5 pt-2">
          <Button full icon="arrow" onClick={handleStart}>
            Start the 2‑minute unlock
          </Button>
          <div className="mt-2 flex gap-2">
            <Button variant="ghost" full className="py-3.5 text-[15.5px]">
              Tweak it
            </Button>
            <Button
              variant="quiet"
              full
              className="text-[15.5px]"
              loading={discarding}
              onClick={handleDiscard}
            >
              {discarding ? "Removing…" : "Not mine"}
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
