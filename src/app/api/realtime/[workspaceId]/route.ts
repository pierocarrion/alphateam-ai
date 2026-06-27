import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  membership as membershipTable,
} from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getRealtimeBroker, type RealtimeEvent } from "@/server/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events endpoint. A connected client receives realtime events
 * scoped to the workspace it belongs to (message_sent, alpha_reply, alpha_insight,
 * task_detected, ...). Heartbeats keep the connection alive through proxies.
 *
 * The client subscribes with `EventSource('/api/realtime/<workspaceId>')`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { workspaceId } = await params;

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) return new Response("Not found", { status: 404 });

  const isMember = await db.query.membership.findFirst({
    where: and(eq(membershipTable.userId, user.id), eq(membershipTable.workspaceId, workspaceId)),
    columns: { id: true },
  });
  if (!isMember) return new Response("Forbidden", { status: 403 });

  const broker = getRealtimeBroker();
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (unsubscribe) unsubscribe();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send({ type: "connected", workspaceId, at: Date.now() });

      heartbeatTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          cleanup();
        }
      }, 25000);

      unsubscribe = broker.subscribe((event: RealtimeEvent) => {
        // Notification events are user-scoped, not workspace-scoped: deliver to
        // the connected user whose id matches the target in `data.userId`.
        if (event.type === "notification_received") {
          const targetUserId = (event.data as { userId?: unknown }).userId;
          if (targetUserId !== user.id) return;
          send(event);
          return;
        }
        if (event.workspaceId !== workspaceId) return;
        send(event);
      });
    },
    cancel() {
      cleanup();
      try {
        // controller is already closed by the runtime on cancel.
      } catch {
        // noop
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
