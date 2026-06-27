import { notFound } from "next/navigation";
import { db } from "@/server/lib/db";
import {
  workspace,
  membership,
  user as userTable,
  workspaceSubscription,
} from "@drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { WorkspaceDetail } from "@/features/admin/components/WorkspaceDetail";

export const dynamic = "force-dynamic";

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [w, subRow, memberships] = await Promise.all([
    db.select({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      hashtag: workspace.hashtag,
      emoji: workspace.emoji,
      description: workspace.description,
      category: workspace.category,
      industry: workspace.industry,
      createdAt: workspace.createdAt,
    })
      .from(workspace)
      .where(eq(workspace.id, id))
      .limit(1),
    db.select({
      plan: workspaceSubscription.plan,
      status: workspaceSubscription.status,
      currentPeriodEnd: workspaceSubscription.currentPeriodEnd,
    })
      .from(workspaceSubscription)
      .where(eq(workspaceSubscription.workspaceId, id))
      .limit(1),
    db.select({
      id: membership.id,
      role: membership.role,
      projectRole: membership.projectRole,
      status: membership.status,
      joinedAt: membership.joinedAt,
      userId: userTable.id,
      userName: userTable.name,
      userEmail: userTable.email,
    })
      .from(membership)
      .innerJoin(userTable, eq(userTable.id, membership.userId))
      .where(eq(membership.workspaceId, id))
      .orderBy(desc(membership.joinedAt)),
  ]);

  const ws = w[0];
  if (!ws) notFound();

  const sub = subRow[0] ?? null;

  return (
    <WorkspaceDetail
      workspace={{
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        hashtag: ws.hashtag,
        emoji: ws.emoji,
        category: ws.category,
        industry: ws.industry,
        description: ws.description,
        createdAt: ws.createdAt.toISOString(),
        subscription: sub
          ? {
              plan: sub.plan,
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            }
          : null,
        memberships: memberships.map((m) => ({
          id: m.id,
          role: m.role,
          projectRole: m.projectRole,
          status: m.status,
          joinedAt: m.joinedAt.toISOString(),
          user: { id: m.userId, name: m.userName, email: m.userEmail },
        })),
      }}
    />
  );
}
