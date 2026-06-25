import { prisma } from "@/server/lib/prisma";
import { UsersTable } from "@/features/admin/components/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
      blocked: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
    take: 200,
  });

  const users = rows.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersTable initialUsers={users} />;
}
