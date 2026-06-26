import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";
import { notifyUser, safeAfter } from "@/server/lib/notifications";

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
    select: { id: true, workspaceId: true, userId: true, role: true },
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

  // Notify the member their role changed (skip if unchanged).
  if (membership.userId && membership.role !== body.role) {
    const targetUserId = membership.userId;
    safeAfter(async () => {
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });
        await notifyUser({
          userId: targetUserId,
          type: "admin_action",
          title: "Tu rol cambió en un proyecto",
          body: `Tu rol en ${
            workspace?.name ?? "el proyecto"
          } ahora es: ${body.role}.`,
          data: { workspaceId, role: body.role },
          workspaceId,
        });
      } catch {
        // best-effort
      }
    });
  }

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
    select: { id: true, workspaceId: true, userId: true },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Membresía no encontrada en este workspace." },
      { status: 404 }
    );
  }

  await prisma.membership.delete({ where: { id: memberId } });

  // Notify the kicked member.
  if (membership.userId) {
    const targetUserId = membership.userId;
    safeAfter(async () => {
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });
        await notifyUser({
          userId: targetUserId,
          type: "admin_action",
          title: "Fuiste removido de un proyecto",
          body: `Un administrador te removió de ${
            workspace?.name ?? "el proyecto"
          }.`,
          data: { workspaceId },
          workspaceId,
        });
      } catch {
        // best-effort
      }
    });
  }

  return NextResponse.json({ ok: true });
}
