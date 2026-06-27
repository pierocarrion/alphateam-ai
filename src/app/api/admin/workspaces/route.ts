import { NextResponse } from "next/server";
import { db } from "@/server/lib/db";
import { workspace, membership, workspaceSubscription } from "@drizzle/schema";
import { eq, and, ilike, desc, count, inArray } from "drizzle-orm";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const plan = searchParams.get("plan"); // free | team | business

  const conditions = [];
  if (q) conditions.push(ilike(workspace.name, `%${q}%`));
  if (plan) {
    conditions.push(
      inArray(
        workspace.id,
        db.select({ id: workspaceSubscription.workspaceId })
          .from(workspaceSubscription)
          .where(eq(workspaceSubscription.plan, plan))
      )
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db.select({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    hashtag: workspace.hashtag,
    emoji: workspace.emoji,
    category: workspace.category,
    createdAt: workspace.createdAt,
    memberCount: count(membership.id),
  })
    .from(workspace)
    .leftJoin(membership, eq(membership.workspaceId, workspace.id))
    .where(where)
    .groupBy(workspace.id)
    .orderBy(desc(workspace.createdAt))
    .limit(500);

  const subs = rows.length
    ? await db.select({
        workspaceId: workspaceSubscription.workspaceId,
        plan: workspaceSubscription.plan,
        status: workspaceSubscription.status,
      })
        .from(workspaceSubscription)
        .where(inArray(workspaceSubscription.workspaceId, rows.map((r) => r.id)))
    : [];
  const subByWs = new Map(subs.map((s) => [s.workspaceId, s]));

  const workspaces = rows.map(({ memberCount, ...w }) => ({
    ...w,
    subscription: subByWs.get(w.id) ?? null,
    subscriptions: undefined,
    _count: { memberships: Number(memberCount) },
  }));

  return NextResponse.json({ workspaces });
}
