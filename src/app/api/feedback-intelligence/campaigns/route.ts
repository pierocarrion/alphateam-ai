import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, feedbackCampaign } from "@drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { jsonError } from "@/server/lib/apiErrors";

/** Lista las campañas activas del workspace (para que un miembro responda). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    }
    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    const { active } = await getActiveWorkspace(user.id);
    if (!active) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });

    const campaigns = await db.query.feedbackCampaign.findMany({
      where: and(
        eq(feedbackCampaign.workspaceId, active.workspaceId),
        eq(feedbackCampaign.status, "active")
      ),
      orderBy: desc(feedbackCampaign.createdAt),
      columns: {
        id: true,
        title: true,
        kind: true,
        questions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    return jsonError(error);
  }
}
