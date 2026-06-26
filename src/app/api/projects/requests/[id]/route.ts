import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import { prisma } from "@/server/lib/prisma";
import { notifyUser, safeAfter } from "@/server/lib/notifications";
import {
  DecideJoinRequest,
  decideJoinRequestSchema,
} from "@/features/projects/application/use-cases/DecideJoinRequest";

const decideJoinRequest = new DecideJoinRequest(container.projectRepository);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = (await parseRequestBody(request)) as Record<string, unknown>;
    const parsed = decideJoinRequestSchema.safeParse({
      ...body,
      requestId: id,
      decidedById: auth.user.id,
    });
    if (!parsed.success) {
      return jsonError(parsed.error);
    }

    const updated = await decideJoinRequest.execute(parsed.data);

    // Notify the applicant of the decision (in-app + push, best-effort).
    safeAfter(async () => {
      try {
        const req = await prisma.joinRequest.findUnique({
          where: { id: updated.id },
          select: { userId: true, workspaceId: true },
        });
        const workspace = req
          ? await prisma.workspace.findUnique({
              where: { id: req.workspaceId },
              select: { name: true, emoji: true },
            })
          : null;
        const wsName = workspace
          ? `${workspace.emoji ?? "🚀"} ${workspace.name}`
          : "el proyecto";
        if (req) {
          const approved = updated.status === "approved";
          await notifyUser({
            userId: req.userId,
            type: approved ? "join_approved" : "join_rejected",
            title: approved ? "Solicitud aprobada" : "Solicitud rechazada",
            body: approved
              ? `Ya puedes participar en ${wsName}.`
              : `Tu solicitud para unirte a ${wsName} fue rechazada.`,
            data: { workspaceId: req.workspaceId, requestId: updated.id },
            workspaceId: req.workspaceId,
            url: `/${req.workspaceId}/requests`,
          });
        }
      } catch {
        // best-effort
      }
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    return jsonError(error);
  }
}
