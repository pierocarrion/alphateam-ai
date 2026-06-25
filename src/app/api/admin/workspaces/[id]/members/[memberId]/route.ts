import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

const ALLOWED_ROLES = new Set(["member", "leader", "admin"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id: workspaceId, memberId } = await params;
  const body = (await request.json().catch(() => ({}))) as { role?: string };

  if (!body.role || !ALLOWED_ROLES.has(body.role)) {
    return NextResponse.json(
      { error: "Rol inválido. Valores permitidos: member | leader | admin" },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
    select: { id: true, workspaceId: true },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Membresía no encontrada en este workspace." },
      { status: 404 }
    );
  }

  const updated = await prisma.membership.update({
    where: { id: memberId },
    data: { role: body.role },
    select: { id: true, role: true },
  });

  return NextResponse.json({ membership: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id: workspaceId, memberId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
    select: { id: true, workspaceId: true },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Membresía no encontrada en este workspace." },
      { status: 404 }
    );
  }

  await prisma.membership.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
