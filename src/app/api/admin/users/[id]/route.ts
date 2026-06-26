import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
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

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
      blocked: true,
      createdAt: true,
      memberships: {
        select: {
          id: true,
          role: true,
          status: true,
          workspace: { select: { id: true, name: true, emoji: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }
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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, globalRole: true },
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

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, blocked: true, globalRole: true },
  });

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

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
