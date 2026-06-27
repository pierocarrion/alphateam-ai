import { NextResponse } from "next/server";
import { db } from "@/server/lib/db";
import {
  membership as membershipTable,
  workspace as workspaceTable,
} from "@drizzle/schema";
import { eq } from "drizzle-orm";
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

  const membership = await db.query.membership.findFirst({
    where: eq(membershipTable.id, memberId),
    columns: { id: true, workspaceId: true, userId: true, role: true },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Membresía no encontrada en este workspace." },
      { status: 404 }
    );
  }

  const [updated] = await db.update(membershipTable)
    .set({ role: body.role })
    .where(eq(membershipTable.id, memberId))
    .returning({ id: membershipTable.id, role: membershipTable.role });

  // Notify the member their role changed (skip if unchanged).
  if (membership.userId && membership.role !== body.role) {
    const targetUserId = membership.userId;
    safeAfter(async () => {
      try {
        const workspace = await db.query.workspace.findFirst({
          where: eq(workspaceTable.id, workspaceId),
          columns: { name: true },
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

  const membership = await db.query.membership.findFirst({
    where: eq(membershipTable.id, memberId),
    columns: { id: true, workspaceId: true, userId: true },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Membresía no encontrada en este workspace." },
      { status: 404 }
    );
  }

  await db.delete(membershipTable).where(eq(membershipTable.id, memberId));

  // Notify the kicked member.
  if (membership.userId) {
    const targetUserId = membership.userId;
    safeAfter(async () => {
      try {
        const workspace = await db.query.workspace.findFirst({
          where: eq(workspaceTable.id, workspaceId),
          columns: { name: true },
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
