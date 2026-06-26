"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEventType } from "@/server/lib/realtime";

interface RealtimeMessage {
  type: RealtimeEventType | "connected";
  workspaceId: string;
  channelId?: string;
  messageId?: string;
  data: Record<string, unknown>;
  at: number;
}

interface UseRealtimeOptions {
  workspaceId: string | null | undefined;
  /** Called for every event; useful for toasts/side effects. */
  onEvent?: (event: RealtimeMessage) => void;
}

/**
 * Subscribes the client to the realtime SSE stream for a workspace and
 * invalidates the relevant react-query caches when events arrive, so the
 * Group Chat, Alpha insights panel and Knowledge Hub stay live without polling.
 */
export function useRealtime({ workspaceId, onEvent }: UseRealtimeOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const es = new EventSource(`/api/realtime/${workspaceId}`);

    es.onmessage = (msg) => {
      let event: RealtimeMessage | null = null;
      try {
        event = JSON.parse(msg.data) as RealtimeMessage;
      } catch {
        return;
      }
      if (!event) return;
      onEvent?.(event);

      switch (event.type) {
        case "message_sent":
        case "alpha_reply":
          if (event.channelId) {
            queryClient.invalidateQueries({ queryKey: ["channel", event.channelId] });
          }
          break;
        case "alpha_insight":
        case "task_detected":
        case "task_updated":
          if (event.channelId) {
            queryClient.invalidateQueries({ queryKey: ["channel-insights", event.channelId] });
          }
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          break;
        default:
          break;
      }
    };

    return () => {
      es.close();
    };
  }, [workspaceId, onEvent, queryClient]);
}
