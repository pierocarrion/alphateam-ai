import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  alphaSession,
  alphaMessage,
  workspaceSubscription,
} from "@drizzle/schema";
import { eq, and, gte, desc, count, inArray } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { getWeeklyLimit, startOfWeek } from "@/server/lib/alphaSpace";
import { AlphaSpaceClient } from "./AlphaSpaceClient";

export default async function AlphaSpacePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true, name: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active || (active.role !== "leader" && active.role !== "admin")) {
    redirect("/home");
  }

  const sub = await db.query.workspaceSubscription.findFirst({
    where: eq(workspaceSubscription.workspaceId, active.workspaceId),
    columns: { plan: true },
  });
  const plan = sub?.plan ?? "team";
  const limit = getWeeklyLimit(plan);
  const since = startOfWeek();
  const [usedThisWeekRow] = await db
    .select({ c: count() })
    .from(alphaSession)
    .where(
      and(
        eq(alphaSession.userId, user.id),
        eq(alphaSession.workspaceId, active.workspaceId),
        gte(alphaSession.createdAt, since)
      )
    );
  const usedThisWeek = Number(usedThisWeekRow?.c ?? 0);

  const sessions = await db.query.alphaSession.findMany({
    where: and(
      eq(alphaSession.userId, user.id),
      eq(alphaSession.workspaceId, active.workspaceId)
    ),
    orderBy: [desc(alphaSession.updatedAt)],
    limit: 30,
    columns: {
      id: true,
      title: true,
      framework: true,
      challenge: true,
      status: true,
      step: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  const counts = sessions.length
    ? await db
        .select({ sessionId: alphaMessage.sessionId, c: count() })
        .from(alphaMessage)
        .where(inArray(alphaMessage.sessionId, sessions.map((s) => s.id)))
        .groupBy(alphaMessage.sessionId)
    : [];
  const countMap = new Map(counts.map((r) => [r.sessionId, Number(r.c)]));

  const serializedSessions = sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    _count: { messages: countMap.get(s.id) ?? 0 },
  }));

  return (
    <AlphaSpaceClient
      leaderName={user.name ?? "Líder"}
      sessions={serializedSessions}
      weeklyLimit={limit}
      usedThisWeek={usedThisWeek}
      plan={plan}
    />
  );
}
