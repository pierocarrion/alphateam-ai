import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, workspaceSubscription } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { jsonError } from "@/server/lib/apiErrors";

export async function GET() {
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

    const { active } = await getActiveWorkspace(user.id);
    const subscription = active
      ? ((await db.query.workspaceSubscription.findFirst({
          where: eq(workspaceSubscription.workspaceId, active.workspaceId),
        })) ?? { plan: "free", status: "active" })
      : { plan: "free", status: "active" };

    return NextResponse.json({ subscription });
  } catch (error) {
    return jsonError(error);
  }
}
