"use client";

import { useState } from "react";
import { Mira, TopBar, Avatar, Weather, Button, Icon, getPerson } from "@/shared/ui";
import type { PersonId } from "@/shared/ui";

interface CrewClientProps {
  warm: boolean;
  mood: { value: number; label: string; note: string };
  loadGuardian: { who: PersonId; title: string; note: string } | null;
  milestone: { title: string; due: string; contributors: PersonId[] } | null;
  pair: { who: PersonId; available: boolean };
}

export function CrewClient({ warm, mood, loadGuardian, milestone, pair }: CrewClientProps) {
  const [paired, setPaired] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <TopBar className="lg:hidden" kicker="Together" title="Crew" trailing={<Mira size={28} mood="calm" />} />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-4 lg:max-w-3xl lg:mx-auto">
        <div className="stagger flex flex-col gap-3.5">
          {/* Collective mood */}
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                How the crew feels
              </p>
              <span className="text-xs text-ink-3">this week</span>
            </div>
            <div className="mt-3.5 flex items-center gap-4">
              <Weather level={mood.value} />
              <div className="flex-1">
                <div className="font-display text-[20px] text-ink">{mood.label}</div>
                <p className="mt-1 text-xs text-ink-3 text-wrap-pretty">{mood.note}</p>
              </div>
            </div>
          </div>

          {/* Load guardian */}
          {loadGuardian && (
            <div
              className="rounded-[24px] border border-glow p-4"
              style={{
                background: "linear-gradient(180deg, var(--color-glow-soft), transparent)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar who={loadGuardian.who} size={42} />
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-glow bg-surface">
                    <Icon name="shield" size={12} color="var(--color-glow)" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--color-glow)" }}>
                    Mira noticed — quietly
                  </p>
                  <div className="mt-1 text-[16px] font-bold leading-snug text-ink">
                    {loadGuardian.title}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3 text-wrap-pretty">{loadGuardian.note}</p>
                </div>
              </div>
              <div className="mt-3.5 flex gap-2">
                <Button className="flex-1 text-[14.5px] py-3">Share the load</Button>
                <Button variant="ghost" className="flex-1 text-[14.5px] py-3">
                  Not now
                </Button>
              </div>
            </div>
          )}

          {/* Milestone */}
          {milestone && (
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                Next tiny milestone
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-accent-soft">
                  <Icon name="spark" size={20} color="var(--color-accent)" />
                </div>
                <div className="flex-1">
                  <div className="text-[16px] font-bold text-ink">{milestone.title}</div>
                  <div className="text-xs text-ink-3">{milestone.due} · small and shared</div>
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-2">
                <div className="flex">
                  {milestone.contributors.map((who, i) => (
                    <Avatar
                      key={who}
                      who={who}
                      size={26}
                      style={{ marginLeft: i ? -8 : 0, boxShadow: "0 0 0 2px var(--color-surface)" }}
                    />
                  ))}
                </div>
                <span className="text-xs text-ink-3">
                  {milestone.contributors.length} of you are easing into it
                </span>
              </div>
            </div>
          )}

          {/* Pair-start */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Avatar who={pair.who} size={38} />
              <div className="flex-1">
                <div className="text-[15.5px] font-bold text-ink">
                  {paired
                    ? `${getPerson(pair.who).name} is starting too — go!`
                    : `${getPerson(pair.who).name} is free to start with you`}
                </div>
                <div className="text-xs text-ink-3">
                  {paired
                    ? "You’re not doing it alone."
                    : "Begin the same 2 minutes side by side."}
                </div>
              </div>
              {paired && <Mira size={26} mood="cheer" />}
            </div>
            <Button
              className="mt-3.5 w-full text-[14.5px] py-3"
              variant={paired ? "primary" : "ghost"}
              onClick={() => {
                if (!paired) {
                  setPaired(true);
                }
              }}
            >
              {paired ? "Starting together…" : "Start together"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
