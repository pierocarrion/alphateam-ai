"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, Button, Icon, Alpha, Weather } from "@/shared/ui";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { fetchJson } from "@/shared/lib/api";

const DEFAULT_TASK: DetectedTaskDraft = {
  title: "Draft the Q3 launch deck",
  fromQuote: "“a first rough draft of the launch deck”",
  category: "Slides",
  app: "Acme Deck Hub",
  due: "this week",
  deadline: null,
  load: "Medium",
  micro: "Open the deck and type one messy sentence.",
  action: "Type one messy sentence in the deck.",
  resource: "Acme Deck Hub",
  selfMade: false,
  confidence: 0.9,
};

interface DesktopRailProps {
  detected: DetectedTaskDraft | null;
  mood: { value: number; label: string; note: string };
  loadGuardian: { who: string; title: string; note: string } | null;
}

export function DesktopRail({ detected, mood, loadGuardian }: DesktopRailProps) {
  const router = useRouter();

  const tasks: DetectedTaskDraft[] = [];
  if (detected) tasks.push(detected);
  if (!tasks.find((t) => t.title === DEFAULT_TASK.title)) {
    tasks.unshift(DEFAULT_TASK);
  }

  const handleStart = async (task: DetectedTaskDraft) => {
    try {
      const data = await fetchJson<{ task: { id: string } }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: task }),
      });
      if (data.task?.id) router.push(`/task/${data.task.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't create that task. Please try again.");
    }
  };

  return (
    <aside className="flex w-[312px] flex-none flex-col overflow-y-auto border-l border-line bg-bg-2 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <Alpha size={30} mood="happy" />
        <div>
          <div className="text-[14.5px] font-bold text-ink">Alpha&apos;s quiet view</div>
          <div className="text-xs text-ink-3">Only you can see this</div>
        </div>
      </div>

      {/* Tiny steps */}
      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
        Your tiny steps
      </div>
      <div className="mb-5 flex flex-col gap-2.5">
        {tasks.map((t, i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-3.5"
          >
            <div className="text-sm font-bold leading-snug text-ink">
              {t.title}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink-2">
                {t.category}
              </span>
              <span className="rounded-full border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink-2">
                {t.app}
              </span>
            </div>
            <Button
              size="sm"
              full
              className="mt-3 text-[13px]"
              onClick={() => handleStart(t)}
            >
              Start 2‑min step
            </Button>
          </div>
        ))}
      </div>

      {/* Team weather */}
      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
        Team weather
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <Weather level={mood.value} size={48} />
        <div>
          <div className="text-sm font-bold text-ink">{mood.label}</div>
          <div className="text-xs text-ink-3">{mood.note}</div>
        </div>
      </div>

      {/* Load guardian */}
      {loadGuardian && (
        <div className="rounded-2xl border border-glow bg-gradient-to-b from-glow-soft to-transparent p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <Icon name="shield" size={16} color="var(--color-glow)" />
            <span className="text-[13px] font-bold text-glow">Load guardian</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Avatar who={loadGuardian.who} size={34} />
            <div className="text-xs leading-relaxed text-ink-2">
              {loadGuardian.title}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            full
            className="mt-2.5 text-[13px]"
            onClick={() => router.push("/crew")}
          >
            Even it out
          </Button>
        </div>
      )}
    </aside>
  );
}
