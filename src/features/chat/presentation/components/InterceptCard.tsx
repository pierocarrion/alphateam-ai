"use client";

import { Button, Mira } from "@/shared/ui";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";

interface InterceptCardProps {
  warm: boolean;
  task: DetectedTaskDraft;
  onShow: () => void;
  onDismiss: () => void;
}

export function InterceptCard({ warm, task, onShow, onDismiss }: InterceptCardProps) {
  return (
    <div
      className="max-w-[290px] rounded-[18px] border border-glow p-3.5"
      style={{
        background: "linear-gradient(180deg, var(--color-surface-2), var(--color-surface))",
        boxShadow: "0 12px 30px -12px var(--color-glow-soft)",
        borderTopLeftRadius: "6px",
      }}
    >
      <div className="flex items-start gap-2.5">
        <Mira size={28} mood="happy" />
        <div className="flex-1">
          <div className="mb-0.5 text-xs font-bold uppercase tracking-wider text-glow">
            Mira · just for you
          </div>
          <div className="text-sm leading-snug text-ink">
            {task.selfMade
              ? warm
                ? "Sounds like a real task hiding in there. Want me to shrink it into a 2‑minute start?"
                : "That sounds like a task. Turn it into a 2‑minute first step?"
              : warm
              ? "I think Daniel just handed you something. Want me to shrink it into a 2‑minute start? No rush at all."
              : "Looks like a task for you here. Want me to turn it into a 2‑minute first step?"}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" size="sm" className="flex-1 text-sm" onClick={onShow}>
          Show me
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 text-sm" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
