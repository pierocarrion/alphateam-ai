import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { requireUser } from "@/server/lib/auth";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

const subscribeSchema = z.object({
  token: z.string().min(1),
  userAgent: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const parsed = subscribeSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    // Upsert by unique token: re-bind to the current user if the device was
    // previously registered to someone else (e.g. shared device).
    await prisma.pushSubscription.upsert({
      where: { token: parsed.data.token },
      create: {
        token: parsed.data.token,
        userId: auth.user.id,
        userAgent: parsed.data.userAgent ?? null,
      },
      update: {
        userId: auth.user.id,
        userAgent: parsed.data.userAgent ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { token, userId: auth.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
