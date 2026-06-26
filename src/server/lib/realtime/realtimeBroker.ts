/**
 * In-process realtime pub/sub broker for Server-Sent Events.
 *
 * Publishers (message POST, Alpha command service, task detection) call
 * {@link publishRealtime}; SSE subscribers ({@link RealtimeSSEHandler})
 * receive events for the workspaces/channels they're authorized on.
 *
 * Scalability seam: for multi-instance deployments (Cloud Run > 1 instance),
 * swap this implementation for a Redis Pub/Sub-backed broker behind the same
 * {@link IRealtimeBroker} interface — no caller changes required.
 */
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("realtime");

export type RealtimeEventType =
  | "message_sent"
  | "alpha_reply"
  | "alpha_insight"
  | "task_detected"
  | "task_updated"
  | "reaction_added"
  | "notification_received";

export interface RealtimeEvent {
  type: RealtimeEventType;
  workspaceId: string;
  channelId?: string;
  messageId?: string;
  data: Record<string, unknown>;
  at: number;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface IRealtimeBroker {
  publish(event: RealtimeEvent): void;
  subscribe(listener: RealtimeListener): () => void;
  listenerCount(): number;
}

export class InProcessRealtimeBroker implements IRealtimeBroker {
  private readonly listeners = new Set<RealtimeListener>();

  publish(event: RealtimeEvent): void {
    // Clone the set before iterating so unsubscribes during dispatch are safe.
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (err) {
        log.error("listener error", err);
      }
    }
  }

  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

let broker: IRealtimeBroker | null = null;

export function getRealtimeBroker(): IRealtimeBroker {
  if (!broker) broker = new InProcessRealtimeBroker();
  return broker;
}

/** Test-only override (e.g. to inject a fake broker). */
export function setRealtimeBroker(b: IRealtimeBroker): void {
  broker = b;
}

/** Convenience: build + publish an event in one call. */
export function publishRealtime(
  type: RealtimeEventType,
  payload: { workspaceId: string; channelId?: string; messageId?: string; data?: Record<string, unknown> }
): void {
  getRealtimeBroker().publish({
    type,
    workspaceId: payload.workspaceId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    data: payload.data ?? {},
    at: Date.now(),
  });
}
