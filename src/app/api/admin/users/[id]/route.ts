import { NextResponse } from "next/server";
import { db } from "@/server/lib/db";
import { user as userTable, membership, workspace } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";
import { notifyUser, safeAfter } from "@/server/lib/notifications";

const ALLOWED_ACTIONS = new Set(["block", "unblock", "promote", "demote"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  const rows = await db.select({
    id: userTable.id,
    name: userTable.name,
    email: userTable.email,
    image: userTable.image,
    globalRole: userTable.globalRole,
    blocked: userTable.blocked,
    createdAt: userTable.createdAt,
    membershipId: membership.id,
    membershipRole: membership.role,
    membershipStatus: membership.status,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceEmoji: workspace.emoji,
  })
    .from(userTable)
    .leftJoin(membership, eq(membership.userId, userTable.id))
    .leftJoin(workspace, eq(workspace.id, membership.workspaceId))
    .where(eq(userTable.id, id));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const first = rows[0];
  const user = {
    id: first.id,
    name: first.name,
    email: first.email,
    image: first.image,
    globalRole: first.globalRole,
    blocked: first.blocked,
    createdAt: first.createdAt,
    memberships: rows
      .filter((r) => r.membershipId !== null)
      .map((r) => ({
        id: r.membershipId,
        role: r.membershipRole,
        status: r.membershipStatus,
        workspace: {
          id: r.workspaceId,
          name: r.workspaceName,
          emoji: r.workspaceEmoji,
        },
      })),
  };

  return NextResponse.json({ user });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (!body.action || !ALLOWED_ACTIONS.has(body.action)) {
    return NextResponse.json(
      { error: "Acción inválida. Usa: block | unblock | promote | demote" },
      { status: 400 }
    );
  }

  const target = await db.query.user.findFirst({
    where: eq(userTable.id, id),
    columns: { id: true, email: true, globalRole: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  // Un super-admin no puede tocarse a sí mismo (evitar autolockout).
  if (target.id === auth.user.id) {
    return NextResponse.json(
      { error: "No puedes modificarte a ti mismo." },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  switch (body.action) {
    case "block":
      data.blocked = true;
      break;
    case "unblock":
      data.blocked = false;
      break;
    case "promote":
      data.globalRole = "superadmin";
      break;
    case "demote":
      data.globalRole = null;
      break;
  }

  const [updated] = await db.update(userTable)
    .set(data)
    .where(eq(userTable.id, id))
    .returning({ id: userTable.id, blocked: userTable.blocked, globalRole: userTable.globalRole });

  // Notify the affected user of the admin action (in-app + push).
  const action = body.action;
  safeAfter(async () => {
    try {
      const titles: Record<string, { title: string; body: string }> = {
        block: {
          title: "Cuenta suspendida",
          body: "Un administrador suspendió tu cuenta. Si crees que es un error, escríbenos.",
        },
        unblock: {
          title: "Cuenta reactivada",
          body: "Tu cuenta fue reactivada. Ya puedes volver a usar la plataforma.",
        },
        promote: {
          title: "Ahora eres administrador",
          body: "Un administrador te dio permisos de super administrador.",
        },
        demote: {
          title: "Permisos de administrador retirados",
          body: "Tu rol de super administrador fue retirado.",
        },
      };
      const msg = action ? titles[action] : undefined;
      if (msg) {
        await notifyUser({
          userId: id,
          type: "admin_action",
          title: msg.title,
          body: msg.body,
          data: { action },
        });
      }
    } catch {
      // best-effort
    }
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 }
    );
  }

  await db.delete(userTable).where(eq(userTable.id, id));
  return NextResponse.json({ ok: true });
}
