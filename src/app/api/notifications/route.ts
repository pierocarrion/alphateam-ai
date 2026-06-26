import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { requireUser } from "@/server/lib/auth";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const notifications = await prisma.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unread = await prisma.notification.count({
      where: { userId: auth.user.id, readAt: null },
    });

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

    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: auth.user.id, readAt: null },
      data: { readAt: new Date() },
    });

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

    await prisma.notification.updateMany({
      where: { userId: auth.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
