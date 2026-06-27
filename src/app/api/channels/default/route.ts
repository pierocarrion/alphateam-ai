import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { channel, membership, user as userTable, workspace } from "@drizzle/schema";
import { eq, inArray, and } from "drizzle-orm";
import { runWorkspaceHealthCheck } from "@/server/lib/aiCheckEngine";
import { jsonError } from "@/server/lib/apiErrors";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const membershipWorkspaceIds = await db
      .select({ workspaceId: membership.workspaceId })
      .from(membership)
      .where(eq(membership.userId, user.id));

    const workspaceRow = membershipWorkspaceIds.length
      ? await db.query.workspace.findFirst({
          where: inArray(
            workspace.id,
            membershipWorkspaceIds.map((m) => m.workspaceId)
          ),
        })
      : null;

    if (!workspaceRow) {
      return NextResponse.json(
        { error: "No default channel is set up for you yet." },
        { status: 404 }
      );
    }

    const channelRow = await db.query.channel.findFirst({
      where: and(
        eq(channel.workspaceId, workspaceRow.id),
        eq(channel.name, "q3-launch")
      ),
    });

    if (!channelRow) {
      return NextResponse.json(
        { error: "We couldn't find the default channel." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("health") === "1") {
      const report = await runWorkspaceHealthCheck(workspaceRow.id);
      return NextResponse.json({
        channel: { id: channelRow.id, name: channelRow.name },
        health: report,
      });
    }

    return NextResponse.json({
      channel: { id: channelRow.id, name: channelRow.name },
    });
  } catch (error) {
    return jsonError(error);
  }
}
