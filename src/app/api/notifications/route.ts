import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { notification as notificationTable } from "@drizzle/schema";
import { eq, and, desc, count, isNull } from "drizzle-orm";
import { requireUser } from "@/server/lib/auth";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const [notifications, unreadRows] = await Promise.all([
      db.query.notification.findMany({
        where: eq(notificationTable.userId, auth.user.id),
        orderBy: desc(notificationTable.createdAt),
        limit: 50,
      }),
      db
        .select({ c: count() })
        .from(notificationTable)
        .where(
          and(
            eq(notificationTable.userId, auth.user.id),
            isNull(notificationTable.readAt)
          )
        ),
    ]);
    const unread = Number(unreadRows[0]?.c ?? 0);

    return NextResponse.json({ notifications, unread });
  } catch (error) {
    return jsonError(error);
  }
}

const readOneSchema = z.object({ id: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await parseRequestBody(request);
    const parsed = readOneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    await db
      .update(notificationTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationTable.id, parsed.data.id),
          eq(notificationTable.userId, auth.user.id),
          isNull(notificationTable.readAt)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH() {
  // Mark all as read.
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    await db
      .update(notificationTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationTable.userId, auth.user.id),
          isNull(notificationTable.readAt)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
