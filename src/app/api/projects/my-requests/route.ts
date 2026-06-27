import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { db } from "@/server/lib/db";
import { joinRequest, workspace } from "@drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { jsonError } from "@/server/lib/apiErrors";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const rows = await db
      .select({
        id: joinRequest.id,
        status: joinRequest.status,
        message: joinRequest.message,
        createdAt: joinRequest.createdAt,
        wsId: workspace.id,
        wsName: workspace.name,
        wsHashtag: workspace.hashtag,
        wsEmoji: workspace.emoji,
      })
      .from(joinRequest)
      .leftJoin(workspace, eq(joinRequest.workspaceId, workspace.id))
      .where(eq(joinRequest.userId, auth.user.id))
      .orderBy(desc(joinRequest.createdAt));

    const data = rows.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
      workspace: {
        id: r.wsId,
        name: r.wsName,
        hashtag: r.wsHashtag,
        emoji: r.wsEmoji,
      },
    }));

    return NextResponse.json({ requests: data });
  } catch (error) {
    return jsonError(error);
  }
}
