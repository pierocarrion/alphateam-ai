import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { userProfile } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

const patchSchema = z.object({
  tone: z.enum(["warm", "balanced"]).optional(),
  gentleCheckIns: z.boolean().optional(),
  pairStartInvites: z.boolean().optional(),
  quietMode: z.boolean().optional(),
});

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const profile = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, auth.user.id),
      columns: {
        tone: true,
        gentleCheckIns: true,
        pairStartInvites: true,
        quietMode: true,
      },
    });

    if (!profile) {
      return NextResponse.json({
        tone: "warm",
        gentleCheckIns: true,
        pairStartInvites: true,
        quietMode: false,
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const parsed = patchSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const [profile] = await db.insert(userProfile)
      .values({
        userId: user.id,
        tone: data.tone ?? "warm",
        gentleCheckIns: data.gentleCheckIns ?? true,
        pairStartInvites: data.pairStartInvites ?? true,
        quietMode: data.quietMode ?? false,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          ...(data.tone !== undefined ? { tone: data.tone } : {}),
          ...(data.gentleCheckIns !== undefined ? { gentleCheckIns: data.gentleCheckIns } : {}),
          ...(data.pairStartInvites !== undefined ? { pairStartInvites: data.pairStartInvites } : {}),
          ...(data.quietMode !== undefined ? { quietMode: data.quietMode } : {}),
        },
      })
      .returning({
        tone: userProfile.tone,
        gentleCheckIns: userProfile.gentleCheckIns,
        pairStartInvites: userProfile.pairStartInvites,
        quietMode: userProfile.quietMode,
      });

    return NextResponse.json(profile);
  } catch (error) {
    return jsonError(error);
  }
}
