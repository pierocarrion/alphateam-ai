import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import { db } from "@/server/lib/db";
import {
  workspace as workspaceTable,
  membership as membershipTable,
  user as userTable,
} from "@drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
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
          db.query.workspace.findFirst({
            where: eq(workspaceTable.id, joinRequest.workspaceId),
            columns: { name: true, emoji: true },
          }),
          db.query.membership.findMany({
            where: and(
              eq(membershipTable.workspaceId, joinRequest.workspaceId),
              inArray(membershipTable.role, ["leader", "admin"]),
              eq(membershipTable.status, "active")
            ),
            columns: { userId: true },
          }),
        ]);
        const wsName = workspace
          ? `${workspace.emoji ?? "🚀"} ${workspace.name}`
          : "Proyecto";
        const applicant = await db.query.user.findFirst({
          where: eq(userTable.id, auth.user.id),
          columns: { name: true },
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
