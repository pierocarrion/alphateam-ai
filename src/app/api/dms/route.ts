import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

function dmChannelName(userIds: [string, string]): string {
  return `dm:${userIds.sort().join(":")}`;
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const channels = await prisma.channel.findMany({
      where: {
        type: "dm",
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, content: true, createdAt: true },
        },
      },
    });

    const dms = channels.map((c) => {
      const peer = c.participants.find((p) => p.userId !== user.id)?.user ?? null;
      const last = c.messages[0];
      return {
        id: c.id,
        peer: peer ? { id: peer.id, name: peer.name } : null,
        lastMessage: last
          ? { id: last.id, preview: last.content.slice(0, 80), at: last.createdAt }
          : null,
      };
    });

    return NextResponse.json({ dms });
  } catch (error) {
    return jsonError(error);
  }
}

const postSchema = z.object({
  partnerId: z.string().min(1),
  workspaceId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const parsed = postSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { partnerId, workspaceId } = parsed.data;

    if (partnerId === user.id) {
      return NextResponse.json(
        { error: "You can't start a DM with yourself." },
        { status: 400 }
      );
    }

    const workspace = workspaceId
      ? await prisma.workspace.findUnique({ where: { id: workspaceId } })
      : await prisma.workspace.findFirst({
          where: { memberships: { some: { userId: user.id } } },
        });

    if (!workspace) {
      return NextResponse.json(
        { error: "We couldn't find a workspace for this conversation." },
        { status: 404 }
      );
    }

    const partnerMembership = await prisma.membership.findFirst({
      where: { workspaceId: workspace.id, userId: partnerId },
    });
    if (!partnerMembership) {
      return NextResponse.json(
        { error: "That person isn't in your workspace." },
        { status: 404 }
      );
    }

    const name = dmChannelName([user.id, partnerId]);

    const existing = await prisma.channel.findFirst({
      where: { workspaceId: workspace.id, type: "dm", name },
      include: { participants: true },
    });

    if (existing) {
      return NextResponse.json({
        channel: { id: existing.id, name: existing.name, type: existing.type },
        created: false,
      });
    }

    const channel = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        name,
        type: "dm",
        participants: {
          create: [{ userId: user.id }, { userId: partnerId }],
        },
      },
      include: { participants: true },
    });

    return NextResponse.json({
      channel: { id: channel.id, name: channel.name, type: channel.type },
      created: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
