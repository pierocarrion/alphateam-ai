"use client";

import { useState } from "react";
import Link from "next/link";
import { Alpha, TopBar, Button } from "@/shared/ui";

interface Task {
  id: string;
  title: string;
  micro: string;
}

interface DayClientProps {
  heroTask: Task | null;
  otherTasks: Task[];
  warm: boolean;
}

export function DayClient({ heroTask, otherTasks }: DayClientProps) {
  const [peek, setPeek] = useState(false);

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background:
          "radial-gradient(120% 70% at 50% -5%, #2a2333 0%, var(--color-bg) 55%, #110f16 100%)",
      }}
    >
      <TopBar title="Just one thing" kicker="Daytime focus" />
      <div className="flex flex-1 flex-col overflow-y-auto scrollbar-hide px-5 pb-4">
        <p className="lead mb-4 pt-2 text-wrap-pretty">
          You’ve got a few things today. I’ve hidden the pile so it can’t pull at you. Here’s the
          only one that matters right now:
        </p>

        <div className="rise rounded-[28px] border border-line-2 bg-gradient-to-br from-surface-2 to-surface p-6 text-center shadow-2xl">
          <Alpha size={56} mood="calm" className="mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">The one thing</p>
          <h1 className="mt-2.5 font-display text-[26px] leading-tight text-ink text-wrap-pretty">
            {heroTask?.title ?? "Draft the Q3 launch deck"}
          </h1>
          <p className="mt-2.5 text-ink-2">
            {heroTask?.micro ?? "First step: open it and type one messy sentence."}
          </p>
          <div className="mt-5">
            <Button href={heroTask ? `/ritual/${heroTask.id}` : "/chat"} full icon="play">
              Start this one
            </Button>
          </div>
        </div>

        <button
          className="mt-4 text-center text-[15px] font-semibold text-ink-3 transition-colors hover:text-ink-2"
          onClick={() => setPeek((p) => !p)}
        >
          {peek ? "Tuck them back away" : `${otherTasks.length} other thing${otherTasks.length === 1 ? "" : "s"} are safe with me`}
        </button>

        {peek && (
          <div className="fade mt-1 flex flex-col gap-2">
            {otherTasks.length === 0 ? (
              <p className="text-center text-xs text-ink-3">Nothing else on your plate right now.</p>
            ) : (
              otherTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/task/${t.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 opacity-70 transition-opacity hover:opacity-100"
                >
                  <div className="h-2 w-2 flex-none rounded-full bg-ink-3" />
                  <span className="text-[14.5px] text-ink-2">{t.title}</span>
                </Link>
              ))
            )}
            <p className="mt-1 text-center text-xs text-ink-3 text-wrap-pretty">
              They’ll wait quietly. No badges, no counters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
