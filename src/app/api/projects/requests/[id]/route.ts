import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import { db } from "@/server/lib/db";
import {
  joinRequest as joinRequestTable,
  workspace as workspaceTable,
} from "@drizzle/schema";
import { eq } from "drizzle-orm";
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
        const req = await db.query.joinRequest.findFirst({
          where: eq(joinRequestTable.id, updated.id),
          columns: { userId: true, workspaceId: true },
        });
        const workspace = req
          ? await db.query.workspace.findFirst({
              where: eq(workspaceTable.id, req.workspaceId),
              columns: { name: true, emoji: true },
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
