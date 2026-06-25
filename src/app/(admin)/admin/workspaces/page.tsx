import { prisma } from "@/server/lib/prisma";
import { WorkspacesTable } from "@/features/admin/components/WorkspacesTable";

export const dynamic = "force-dynamic";

export default async function AdminWorkspacesPage() {
  const rows = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      hashtag: true,
      emoji: true,
      category: true,
      createdAt: true,
      subscriptions: { take: 1, select: { plan: true, status: true } },
      _count: { select: { memberships: true } },
    },
    take: 200,
  });

  const workspaces = rows.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    hashtag: w.hashtag,
    emoji: w.emoji,
    category: w.category,
    createdAt: w.createdAt.toISOString(),
    subscription: w.subscriptions[0] ?? null,
    _count: w._count,
  }));

  return <WorkspacesTable initial={workspaces} />;
}
