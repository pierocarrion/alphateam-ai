import { notFound } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { WorkspaceDetail } from "@/features/admin/components/WorkspaceDetail";

export const dynamic = "force-dynamic";

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const w = await prisma.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      hashtag: true,
      emoji: true,
      description: true,
      category: true,
      industry: true,
      createdAt: true,
      subscriptions: {
        take: 1,
        select: { plan: true, status: true, currentPeriodEnd: true },
      },
      memberships: {
        select: {
          id: true,
          role: true,
          projectRole: true,
          status: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: "desc" },
      },
    },
  });

  if (!w) notFound();

  const sub = w.subscriptions[0] ?? null;

  return (
    <WorkspaceDetail
      workspace={{
        id: w.id,
        name: w.name,
        slug: w.slug,
        hashtag: w.hashtag,
        emoji: w.emoji,
        category: w.category,
        industry: w.industry,
        description: w.description,
        createdAt: w.createdAt.toISOString(),
        subscription: sub
          ? {
              plan: sub.plan,
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            }
          : null,
        memberships: w.memberships.map((m) => ({
          id: m.id,
          role: m.role,
          projectRole: m.projectRole,
          status: m.status,
          joinedAt: m.joinedAt.toISOString(),
          user: { id: m.user.id, name: m.user.name, email: m.user.email },
        })),
      }}
    />
  );
}
