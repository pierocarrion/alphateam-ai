import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = searchParams.get("status"); // "active" | "blocked" | "superadmin"

  const where: Record<string, unknown> = {};
  if (q) where.email = { contains: q, mode: "insensitive" };
  if (status === "blocked") where.blocked = true;
  if (status === "active") where.blocked = false;
  if (status === "superadmin") where.globalRole = "superadmin";

  const users = await prisma.user.findMany({
    where,
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
    take: 500,
  });

  return NextResponse.json({ users });
}
