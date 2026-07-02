"use client";

import { useCallback, useRef, useState } from "react";
import { fetchJson, ApiError } from "@/shared/lib/api";
import type {
  AssistantAnswer,
  AssistantConfidence,
} from "../../../application/assistant/AskTeamAssistant";

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  /** For assistant messages, the full structured answer; undefined for user turns. */
  answer?: AssistantAnswer;
  /** Plain text content (user question, or assistant.reply as fallback). */
  content: string;
  /** Timestamp for ordering / future use. */
  at: number;
  /** Marks assistant turns produced while the AI provider was unavailable. */
  pending?: boolean;
}

export interface UseTeamAssistantParams {
  /** Days window the dashboard is showing — sent so the model matches the view. */
  daysWindow?: number;
  /** Query string of dashboard filters to keep AI context in sync with the view. */
  filterQuery?: string;
}

export interface UseTeamAssistantResult {
  messages: AssistantMessage[];
  sending: boolean;
  error: string | null;
  ask: (question: string) => Promise<void>;
  reset: () => void;
  /** History formatted for the API (role/content), capped to last ~10 turns. */
  serializedHistory: () => { role: "user" | "assistant"; content: string }[];
}

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function toApiHistory(messages: AssistantMessage[]): {
  role: "user" | "assistant";
  content: string;
}[] {
  return messages
    .filter((m) => !m.pending)
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: m.role === "assistant" ? (m.answer?.reply ?? m.content) : m.content,
    }));
}

/**
 * Conversation state for the Team Insights Assistant drawer.
 *
 * - Mirrors the look-and-feel of `useTeamInsights` (loading / error / data).
 * - Keeps the history on the client; the API re-derives dashboard context from
 *   the active workspace so the model is always grounded.
 */
export function useTeamAssistant(
  params: UseTeamAssistantParams = {}
): UseTeamAssistantResult {
  const { daysWindow = 90, filterQuery = "" } = params;
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const serializedHistory = useCallback(
    () => toApiHistory(messages),
    [messages]
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;

      setError(null);

      const userMsg: AssistantMessage = {
        id: makeId("u"),
        role: "user",
        content: trimmed,
        at: Date.now(),
      };

      // Build history BEFORE appending the new user turn so the model gets
      // prior context but not its own (still un-asked) question.
      const history = toApiHistory(messages);

      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      const qs = filterQuery ? `?${filterQuery}` : "";

      try {
        const answer = await fetchJson<AssistantAnswer>(
          `/api/team-insights/assistant${qs}`,
          {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: trimmed,
              history,
              daysWindow,
            }),
          }
        );

        const assistantMsg: AssistantMessage = {
          id: makeId("a"),
          role: "assistant",
          content: answer.reply,
          answer,
          at: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        if (controller.signal.aborted) return;
        const message =
          e instanceof ApiError
            ? e.message
            : "I couldn't process your question. Please try again.";
        setError(message);
      } finally {
        setSending(false);
      }
    },
    [daysWindow, filterQuery, messages, sending]
  );

  const reset = useCallback(() => {
    inFlight.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    sending,
    error,
    ask,
    reset,
    serializedHistory,
  };
}

export type { AssistantAnswer, AssistantConfidence };
