"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { Icon, Alpha } from "@/shared/ui";

interface GoalCopilotChatProps {
  goalId: string;
}

const SUGGESTIONS = [
  "¿Cómo vamos respecto al objetivo SMART?",
  "¿Quién aporta más al progreso?",
  "¿Qué hitos se completaron esta semana?",
  "¿Cuál es la probabilidad de terminar a tiempo?",
  "¿Qué tareas están frenando el progreso?",
];

/**
 * AI Copilot chat for a single SMART goal. Asks natural-language questions
 * grounded on the goal's computed report via /api/goals/:id/copilot.
 */
export function GoalCopilotChat({ goalId }: GoalCopilotChatProps) {
  const [question, setQuestion] = useState("");
  const [exchange, setExchange] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setQuestion("");
    try {
      const data = await fetchJson<{ answer: string; usedGemini: boolean }>(
        `/api/goals/${goalId}/copilot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        }
      );
      setExchange((prev) => [...prev, { q: trimmed, a: data.answer }]);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No pudimos responder ahora. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Alpha size={22} mood="thinking" />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
          Copiloto del objetivo
        </p>
      </div>

      {exchange.length === 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-left text-[12px] text-ink-2 transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex max-h-[260px] flex-col gap-2.5 overflow-y-auto scrollbar-hide">
          {exchange.map((ex, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="self-end rounded-[14px] rounded-br-sm bg-accent-soft px-3 py-2 text-[13px] text-ink">
                {ex.q}
              </div>
              <div className="flex items-start gap-2">
                <Alpha size={18} mood="calm" />
                <p className="flex-1 rounded-[14px] rounded-bl-sm bg-surface-2 px-3 py-2 text-[13px] text-ink-2 text-wrap-pretty">
                  {ex.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregúntale a Alpha sobre el objetivo…"
          className="flex-1 rounded-full border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          aria-label="Enviar pregunta"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-50"
        >
          <Icon name="send" size={16} color="var(--color-accent-ink)" />
        </button>
      </form>
    </div>
  );
}
