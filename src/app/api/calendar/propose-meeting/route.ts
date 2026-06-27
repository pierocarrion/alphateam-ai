import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import {
  membership as membershipTable,
  user as userTable,
  meeting as meetingTable,
} from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/server/lib/auth";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  jsonError,
  toFriendlyMessage,
} from "@/server/lib/apiErrors";
import { UserFacingError } from "@/server/lib/errors";
import { isGoogleConnected } from "@/server/services/googleCalendar";
import { proposeMeetingSlot, NoSharedSlotError } from "@/server/lib/scheduling";

const bodySchema = z.object({
  expertId: z.string().min(1),
  reason: z.string().min(4, "Cuéntanos brevemente qué contexto necesitas.").max(280),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const requesterId = auth.user.id;

    const parsed = bodySchema.safeParse(await parseBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }
    const { expertId, reason } = parsed.data;

    if (expertId === requesterId) {
      throw new UserFacingError(
        "No puedes agendar una sesión de contexto contigo mismo.",
        400
      );
    }

    const { active } = await getActiveWorkspace(requesterId);
    if (!active) {
      throw new UserFacingError(
        "Necesitas estar en un proyecto para proponer una sesión.",
        400
      );
    }

    // The expert must share the requester's active workspace.
    const [expertMembership] = await db
      .select({
        role: membershipTable.role,
        userId: userTable.id,
        userName: userTable.name,
      })
      .from(membershipTable)
      .innerJoin(userTable, eq(membershipTable.userId, userTable.id))
      .where(
        and(
          eq(membershipTable.userId, expertId),
          eq(membershipTable.workspaceId, active.workspaceId)
        )
      )
      .limit(1);
    if (!expertMembership) {
      throw new UserFacingError(
        "Esa persona no es parte de tu proyecto actual.",
        403
      );
    }

    const requester = await db.query.user.findFirst({
      where: eq(userTable.id, requesterId),
      columns: { name: true },
    });

    const [requesterConnected, expertConnected] = await Promise.all([
      isGoogleConnected(requesterId),
      isGoogleConnected(expertId),
    ]);
    if (!requesterConnected) {
      throw new UserFacingError(
        "Conecta tu Google Calendar en Ajustes para que podamos encontrar un horario.",
        400
      );
    }
    if (!expertConnected) {
      throw new UserFacingError(
        `${expertMembership.userName ?? "Esa persona"} aún no conecta su Google Calendar. Pídele que lo haga desde Ajustes.`,
        409
      );
    }

    const proposal = await proposeMeetingSlot({
      requesterId,
      expertId,
      requesterName: requester?.name ?? "Someone",
      expertName: expertMembership.userName ?? "Someone",
      reason,
    });

    const [meeting] = await db
      .insert(meetingTable)
      .values({
        workspaceId: active.workspaceId,
        ownerId: requesterId,
        title: `Sesión de contexto · ${expertMembership.userName ?? "experto"}`,
        reason,
        scheduledAt: new Date(proposal.start),
        status: "pending",
      })
      .returning({ id: meetingTable.id });

    return NextResponse.json({
      meetingId: meeting.id,
      ...proposal,
    });
  } catch (error) {
    if (error instanceof NoSharedSlotError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return jsonError(error);
  }
}

async function parseBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
    } catch {
      throw new UserFacingError("Envía una solicitud válida.", 400);
    }
}
