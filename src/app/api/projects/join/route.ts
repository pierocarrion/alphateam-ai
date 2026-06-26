import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import { prisma } from "@/server/lib/prisma";
import { notifyUsers, safeAfter } from "@/server/lib/notifications";
import { RequestToJoin } from "@/features/projects/application/use-cases/RequestToJoin";

const requestToJoinSchema = z.object({
  hashtag: z.string().min(1),
  message: z.string().max(280).optional(),
});

const requestToJoin = new RequestToJoin(container.projectRepository);

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await parseRequestBody(request)) as Record<string, unknown>;
    const parsed = requestToJoinSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error);
    }

    const joinRequest = await requestToJoin.execute({
      userId: auth.user.id,
      hashtag: parsed.data.hashtag,
      message: parsed.data.message,
    });

    // Notify all leaders/admins of the project about the new pending request.
    safeAfter(async () => {
      try {
        const [workspace, leaders] = await Promise.all([
          prisma.workspace.findUnique({
            where: { id: joinRequest.workspaceId },
            select: { name: true, emoji: true },
          }),
          prisma.membership.findMany({
            where: {
              workspaceId: joinRequest.workspaceId,
              role: { in: ["leader", "admin"] },
              status: "active",
            },
            select: { userId: true },
          }),
        ]);
        const wsName = workspace
          ? `${workspace.emoji ?? "🚀"} ${workspace.name}`
          : "Proyecto";
        const applicant = await prisma.user.findUnique({
          where: { id: auth.user.id },
          select: { name: true },
        });
        const who = applicant?.name ?? "Alguien";
        await notifyUsers(
          leaders.map((l) => ({
            userId: l.userId,
            type: "join_request_received" as const,
            title: "Nueva solicitud para unirse",
            body: `${who} quiere unirse a ${wsName}.`,
            data: {
              workspaceId: joinRequest.workspaceId,
              requestId: joinRequest.id,
            },
            workspaceId: joinRequest.workspaceId,
            url: `/${joinRequest.workspaceId}/requests`,
          }))
        );
      } catch {
        // best-effort
      }
    });

    return NextResponse.json({ request: joinRequest });
  } catch (error) {
    return jsonError(error);
  }
}
