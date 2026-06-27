import { NextResponse } from "next/server";
import { db } from "@/server/lib/db";
import { user, membership } from "@drizzle/schema";
import { eq, and, ilike, desc, count } from "drizzle-orm";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = searchParams.get("status"); // "active" | "blocked" | "superadmin"

  const conditions = [];
  if (q) conditions.push(ilike(user.email, `%${q}%`));
  if (status === "blocked") conditions.push(eq(user.blocked, true));
  if (status === "active") conditions.push(eq(user.blocked, false));
  if (status === "superadmin") conditions.push(eq(user.globalRole, "superadmin"));
  const where = conditions.length ? and(...conditions) : undefined;

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
    .where(where)
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(500);

  const users = rows.map(({ membershipCount, ...u }) => ({
    ...u,
    _count: { memberships: Number(membershipCount) },
  }));

  return NextResponse.json({ users });
}
