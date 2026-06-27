/**
 * Core notification service.
 *
 * One entry point — {@link notifyUser} — that:
 *   1. Persists a {@link Notification} row (the durable inbox record).
 *   2. Publishes a `notification_received` realtime event so any connected
 *      client for that user updates the bell badge instantly.
 *   3. Best-effort sends an FCM web push to the user's registered devices.
 *
 * Callers should invoke this from `after()` (fire-and-forget) so it never
 * blocks the HTTP response and never surfaces failures to the end user.
 */
import { db } from "@/server/lib/db";
import { notification, pushSubscription } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { publishRealtime } from "@/server/lib/realtime";
import { sendPush } from "./fcm";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("notifications");

export type NotificationType =
  | "join_approved"
  | "join_rejected"
  | "task_assigned"
  | "invite_received"
  | "payment_failed"
  | "subscription_cancelled"
  | "admin_action"
  | "join_request_received"
  | "dm_started";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Arbitrary context for deep-linking / client rendering. */
  data?: Record<string, unknown>;
  /** Workspace to scope the realtime event. Falls back to "global". */
  workspaceId?: string;
  /** Optional deep-link URL for push click. */
  url?: string;
}

export interface NotifyResult {
  id: string;
  pushed: number;
}

/**
 * Persist + broadcast + push a notification for a single user.
 * Never throws — logs and returns a null-ish result on failure.
 */
export async function notifyUser(input: NotifyInput): Promise<NotifyResult | null> {
  try {
    const [created] = await db
      .insert(notification)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as object,
      })
      .returning({ id: notification.id });
    const createdId = created!.id;

    // Realtime: user-scoped delivery (the SSE route matches on data.userId).
    publishRealtime("notification_received", {
      workspaceId: input.workspaceId ?? "__global__",
      data: {
        userId: input.userId,
        notificationId: createdId,
        type: input.type,
        title: input.title,
        body: input.body,
      },
    });

    // Push: best-effort, fetch tokens lazily.
    let pushed = 0;
    try {
      const subs = await db.query.pushSubscription.findMany({
        where: eq(pushSubscription.userId, input.userId),
        columns: { token: true },
      });
      if (subs.length) {
        pushed = await sendPush({
          tokens: subs.map((s) => s.token),
          title: input.title,
          body: input.body,
          data: input.data
            ? Object.fromEntries(
                Object.entries(input.data).map(([k, v]) => [k, String(v)])
              )
            : undefined,
          url: input.url,
        });
      }
    } catch (pushErr) {
      log.error("push side-effect failed", pushErr);
    }

    return { id: createdId, pushed };
  } catch (err) {
    log.error("notifyUser failed", err);
    return null;
  }
}

/**
 * Convenience: notify many users (e.g. all leaders of a workspace) in parallel.
 * Each call is independent and failure-isolated.
 */
export async function notifyUsers(
  users: Array<{ userId: string } & Omit<NotifyInput, "userId">>
): Promise<void> {
  await Promise.allSettled(users.map((u) => notifyUser(u)));
}
