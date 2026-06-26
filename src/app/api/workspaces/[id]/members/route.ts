import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { InviteMember } from "@/features/project-settings/application/use-cases/ManageMembers";
import { inviteSchema } from "@/features/project-settings/application/schemas";
import { prisma } from "@/server/lib/prisma";
import { notifyUser, safeAfter } from "@/server/lib/notifications";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProjectLeader((await params).id);
    if (auth.response) return auth.response;
    const deps = getProjectSettingsDeps();
    const [members, invitations] = await Promise.all([
      deps.memberRepository.list(auth.workspaceId!),
      deps.memberRepository.listInvitations(auth.workspaceId!),
    ]);
    return NextResponse.json({ members, invitations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProjectLeader((await params).id);
    if (auth.response) return auth.response;

    const parsed = inviteSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const deps = getProjectSettingsDeps();
    const useCase = new InviteMember(deps);
    const workspaceId = auth.workspaceId!;
    const invitation = await useCase.execute(
      workspaceId,
      auth.user.id,
      parsed.data
    );

    // Notify the invitee in-app + push IF they already have an account. For
    // emails not yet registered, the invitation row stays pending and will be
    // claimed when they sign up (no email channel in this build).
    const email = parsed.data.email.trim().toLowerCase();
    safeAfter(async () => {
      try {
        const invitee = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true },
        });
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true, emoji: true },
        });
        const wsName = workspace
          ? `${workspace.emoji ?? "🚀"} ${workspace.name}`
          : "Proyecto";
        if (invitee) {
          await notifyUser({
            userId: invitee.id,
            type: "invite_received",
            title: "Te invitaron a un proyecto",
            body: `Fuiste invitado a ${wsName}.`,
            data: { workspaceId, invitationId: invitation.id },
            workspaceId,
            url: `/${workspaceId}/team`,
          });
        }
      } catch {
        // best-effort
      }
    });

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
