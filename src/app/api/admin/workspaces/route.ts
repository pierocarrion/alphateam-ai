import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const plan = searchParams.get("plan"); // free | team | business

  const where: Record<string, unknown> = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (plan) where.subscriptions = { some: { plan } };

  const workspaces = await prisma.workspace.findMany({
    where,
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
    take: 500,
  });

  return NextResponse.json({
    workspaces: workspaces.map((w) => ({
      ...w,
      subscription: w.subscriptions[0] ?? null,
      subscriptions: undefined,
    })),
  });
}
