"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/shared/ui";
import { fetchJson } from "@/shared/lib/api";
import { cn } from "@/shared/lib/cn";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

interface InsightTask {
  id: string;
  title: string;
  category: string;
  priority: number | null;
  deadline: string | null;
  status: string;
  owner: string | null;
  tags: string[];
  fromQuote: string | null;
}

interface Insight {
  id: string;
  type: string;
  payload: { reply?: string; argument?: string; usedAi?: boolean };
  createdAt: string;
}

interface MiraInsightsPanelProps {
  channelId: string;
}

const TYPE_KEYS: Record<string, string> = {
  summary: "mira.type.summary",
  risks: "mira.type.risks",
  tasks: "mira.type.tasks",
  decisions: "mira.type.decisions",
  retrospective: "mira.type.retrospective",
  strategy: "mira.type.strategy",
  fetch: "mira.type.fetch",
  general: "mira.type.general",
};

export function MiraInsightsPanel({ channelId }: MiraInsightsPanelProps) {
  const [tasks, setTasks] = useState<InsightTask[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "insights">("tasks");
  const [locale] = useLocale();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchJson<{ tasks: InsightTask[]; insights: Insight[] }>(
          `/api/channels/${channelId}/insights`
        );
        if (!active) return;
        setTasks(res.tasks);
        setInsights(res.insights);
      } catch {
        // silent: panel is auxiliary
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [channelId]);

  return (
    <aside className="hidden w-[300px] flex-none flex-col border-l border-line bg-bg-2 xl:flex">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="spark" size={16} color="var(--color-accent)" />
        <span className="text-[13px] font-bold text-ink">{t(locale, "mira.panel")}</span>
      </div>

      <div className="flex border-b border-line">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>
          {t(locale, "mira.tasks", { count: tasks.length })}
        </TabButton>
        <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
          {t(locale, "mira.insights", { count: insights.length })}
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="px-2 text-xs text-ink-3">{t(locale, "mira.analyzing")}</p>
        ) : tab === "tasks" ? (
          tasks.length === 0 ? (
            <Empty text={t(locale, "mira.noTasks")} />
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((tk) => (
                <div key={tk.id} className="rounded-card border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-ink">{tk.title}</p>
                    {tk.priority != null && <PriorityDot priority={tk.priority} />}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px] text-ink-3">
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{tk.category}</span>
                    {tk.owner && <span>· {tk.owner}</span>}
                    {tk.deadline && <span>· 📅 {new Date(tk.deadline).toLocaleDateString()}</span>}
                  </div>
                  {tk.fromQuote && (
                    <p className="mt-1.5 text-[11px] italic text-ink-3">“{tk.fromQuote.slice(0, 90)}”</p>
                  )}
                </div>
              ))}
            </div>
          )
        ) : insights.length === 0 ? (
          <Empty text={t(locale, "mira.noInsights")} />
        ) : (
          <div className="flex flex-col gap-2">
            {insights.map((i) => (
              <div key={i.id} className="rounded-card border border-line bg-surface p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    {TYPE_KEYS[i.type] ? t(locale, TYPE_KEYS[i.type]) : i.type}
                  </span>
                  <span className="text-[10px] text-ink-3">
                    {new Date(i.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {i.payload.reply && (
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">
                    {i.payload.reply.slice(0, 320)}
                    {i.payload.reply.length > 320 ? "…" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 border-b-2 px-3 py-2 text-[12px] font-bold transition-colors",
        active
          ? "border-accent text-ink"
          : "border-transparent text-ink-3 hover:text-ink-2"
      )}
    >
      {children}
    </button>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const color =
    priority >= 4 ? "var(--color-glow)" : priority >= 3 ? "#f59e0b" : "var(--color-ink-3)";
  return <span className="h-2 w-2 flex-none rounded-full" style={{ background: color }} />;
}

function Empty({ text }: { text: string }) {
  return <p className="px-2 text-xs text-ink-3">{text}</p>;
}
