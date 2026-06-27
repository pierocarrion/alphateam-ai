import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import {
  channel,
  channelParticipant,
  membership,
  message,
  user as userTable,
  workspace,
} from "@drizzle/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";
import { notifyUser, safeAfter } from "@/server/lib/notifications";

function dmChannelName(userIds: [string, string]): string {
  return `dm:${userIds.sort().join(":")}`;
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const myParticipations = await db.query.channelParticipant.findMany({
      where: eq(channelParticipant.userId, user.id),
      columns: { channelId: true },
    });
    const channelIds = myParticipations.map((p) => p.channelId);

    const channels = channelIds.length
      ? await db.query.channel.findMany({
          where: and(
            inArray(channel.id, channelIds),
            eq(channel.type, "dm")
          ),
        })
      : [];

    const channelIdsDm = channels.map((c) => c.id);

    const [participants, lastByChannel] = await Promise.all([
      channelIdsDm.length
        ? db
            .select({
              channelId: channelParticipant.channelId,
              userId: channelParticipant.userId,
              userName: userTable.name,
            })
            .from(channelParticipant)
            .leftJoin(userTable, eq(userTable.id, channelParticipant.userId))
            .where(inArray(channelParticipant.channelId, channelIdsDm))
        : Promise.resolve([]),
      (async () => {
        const map = new Map<
          string,
          { id: string; content: string; createdAt: Date }
        >();
        await Promise.all(
          channelIdsDm.map(async (cid) => {
            const [last] = await db
              .select({
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
              })
              .from(message)
              .where(eq(message.channelId, cid))
              .orderBy(desc(message.createdAt))
              .limit(1);
            if (last) map.set(cid, last);
          })
        );
        return map;
      })(),
    ]);

    const dms = channels.map((c) => {
      const peerParticipant = participants.find(
        (p) => p.channelId === c.id && p.userId !== user.id
      );
      const peer = peerParticipant
        ? { id: peerParticipant.userId, name: peerParticipant.userName ?? null }
        : null;
      const last = lastByChannel.get(c.id);
      return {
        id: c.id,
        peer,
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

    let workspaceRow;
    if (workspaceId) {
      workspaceRow = await db.query.workspace.findFirst({
        where: eq(workspace.id, workspaceId),
      });
    } else {
      const firstMembership = await db.query.membership.findFirst({
        where: eq(membership.userId, user.id),
        orderBy: asc(membership.joinedAt),
      });
      workspaceRow = firstMembership
        ? await db.query.workspace.findFirst({
            where: eq(workspace.id, firstMembership.workspaceId),
          })
        : null;
    }

    if (!workspaceRow) {
      return NextResponse.json(
        { error: "We couldn't find a workspace for this conversation." },
        { status: 404 }
      );
    }

    const partnerMembership = await db.query.membership.findFirst({
      where: and(
        eq(membership.workspaceId, workspaceRow.id),
        eq(membership.userId, partnerId)
      ),
    });
    if (!partnerMembership) {
      return NextResponse.json(
        { error: "That person isn't in your workspace." },
        { status: 404 }
      );
    }

    const name = dmChannelName([user.id, partnerId]);

    const existing = await db.query.channel.findFirst({
      where: and(
        eq(channel.workspaceId, workspaceRow.id),
        eq(channel.type, "dm"),
        eq(channel.name, name)
      ),
    });

    if (existing) {
      return NextResponse.json({
        channel: { id: existing.id, name: existing.name, type: existing.type },
        created: false,
      });
    }

    const [createdChannel] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(channel)
        .values({
          workspaceId: workspaceRow.id,
          name,
          type: "dm",
        })
        .returning();
      await tx.insert(channelParticipant).values([
        { channelId: created.id, userId: user.id },
        { channelId: created.id, userId: partnerId },
      ]);
      return [created] as const;
    });

    const channelId = createdChannel.id;

    safeAfter(async () => {
      try {
        const [starter, ws] = await Promise.all([
          db.query.user.findFirst({
            where: eq(userTable.id, user.id),
            columns: { name: true },
          }),
          db.query.workspace.findFirst({
            where: eq(workspace.id, workspaceRow.id),
            columns: { name: true },
          }),
        ]);
        await notifyUser({
          userId: partnerId,
          type: "dm_started",
          title: "Nuevo mensaje directo",
          body: `${
            starter?.name ?? "Alguien"
          } inició una conversación contigo${
            ws ? ` · ${ws.name}` : ""
          }.`,
          data: {
            workspaceId: workspaceRow.id,
            channelId,
            partnerId: user.id,
          },
          workspaceId: workspaceRow.id,
          url: `/${workspaceRow.id}/chat`,
        });
      } catch {
      }
    });

    return NextResponse.json({
      channel: {
        id: createdChannel.id,
        name: createdChannel.name,
        type: createdChannel.type,
      },
      created: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
