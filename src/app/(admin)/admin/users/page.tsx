import { db } from "@/server/lib/db";
import { user, membership } from "@drizzle/schema";
import { eq, desc, count } from "drizzle-orm";
import { UsersTable } from "@/features/admin/components/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const rows = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    globalRole: user.globalRole,
    blocked: user.blocked,
    createdAt: user.createdAt,
    membershipCount: count(membership.id),
  })
    .from(user)
    .leftJoin(membership, eq(membership.userId, user.id))
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(200);

  const users = rows.map(({ membershipCount, ...u }) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    _count: { memberships: Number(membershipCount) },
  }));

  return <UsersTable initialUsers={users} />;
}
