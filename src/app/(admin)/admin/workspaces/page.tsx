import { db } from "@/server/lib/db";
import { workspace, membership, workspaceSubscription } from "@drizzle/schema";
import { eq, desc, count, inArray } from "drizzle-orm";
import { WorkspacesTable } from "@/features/admin/components/WorkspacesTable";

export const dynamic = "force-dynamic";

export default async function AdminWorkspacesPage() {
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
    .groupBy(workspace.id)
    .orderBy(desc(workspace.createdAt))
    .limit(200);

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
    id: w.id,
    name: w.name,
    slug: w.slug,
    hashtag: w.hashtag,
    emoji: w.emoji,
    category: w.category,
    createdAt: w.createdAt.toISOString(),
    subscription: subByWs.get(w.id) ?? null,
    _count: { memberships: Number(memberCount) },
  }));

  return <WorkspacesTable initial={workspaces} />;
}
