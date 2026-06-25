"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mira, Button } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import type { DetectedTaskDraft } from "@/features/tasks/lib/detect";

export function CaptureClient() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleShrink = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const detect = await fetchJson<{ detected: DetectedTaskDraft | null }>(
        "/api/tasks/detect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, force: true }),
        }
      );

      const draft = detect.detected;
      if (!draft) {
        toast.error("Mira couldn’t shape that into a step yet. Try a sentence or two more.");
        setBusy(false);
        return;
      }

      const created = await fetchJson<{ task: { id: string } }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });

      if (created.task?.id) {
        router.push(`/task/${created.task.id}`);
      } else {
        toast.error("We couldn’t save that step. Please try again.");
        setBusy(false);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Mira couldn’t shrink that. Please try again."
      );
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="h-[58px] flex-none" />
      <div className="flex flex-1 flex-col justify-center px-6 pb-6">
        <Mira size={64} mood={busy ? "thinking" : "calm"} className="mx-auto mb-5" />
        <h1 className="h1 text-center text-wrap-pretty">What’s on your mind?</h1>
        <p className="body mt-2.5 text-center text-ink-2">
          {busy
            ? "Mira’s shrinking it down to one tiny step…"
            : "Just say it plainly. Don’t organize it — that’s my job."}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I keep avoiding the budget review…"
          rows={3}
          disabled={busy}
          className="mt-5 w-full resize-none rounded-[18px] border-[1.5px] border-line-2 bg-surface p-4 text-[16.5px] leading-relaxed text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
        />
        <p className="mt-3 text-center text-xs text-ink-3">No due dates. No labels. Just the thing.</p>
        <div className="mt-5">
          <Button
            full
            size="lg"
            icon="arrow"
            loading={busy}
            disabled={!text.trim() || busy}
            onClick={handleShrink}
          >
            {busy ? "Shrinking…" : "Shrink it to one tiny step"}
          </Button>
        </div>
        <button
          onClick={() => router.push("/home")}
          disabled={busy}
          className="mt-3 text-center text-[15px] font-semibold text-ink-3 transition-colors hover:text-ink-2 disabled:opacity-60"
        >
          Close
        </button>
      </div>
    </div>
  );
}
