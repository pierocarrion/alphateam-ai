import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  channel as channelTable,
  channelParticipant,
  membership,
} from "@drizzle/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  // Scope the default channel to the active workspace only, so the index
  // never drops the user into a channel of a different project.
  const active = await getActiveWorkspace(user.id);
  const workspaceId = active.active?.workspaceId;

  const firstChannel = workspaceId
    ? await db.query.channel.findFirst({
        where: and(
          eq(channelTable.type, "channel"),
          eq(channelTable.workspaceId, workspaceId)
        ),
        orderBy: asc(channelTable.name),
        columns: { id: true },
      })
    : await db.query.channel.findFirst({
        where: and(
          eq(channelTable.type, "channel"),
          inArray(
            channelTable.workspaceId,
            db
              .select({ id: membership.workspaceId })
              .from(membership)
              .where(eq(membership.userId, user.id))
          )
        ),
        orderBy: asc(channelTable.name),
        columns: { id: true },
      });

  if (firstChannel) {
    redirect(`/chat/${firstChannel.id}`);
  }

  const firstDm = await db
    .select({ id: channelTable.id })
    .from(channelTable)
    .innerJoin(
      channelParticipant,
      eq(channelParticipant.channelId, channelTable.id)
    )
    .where(
      and(
        eq(channelTable.type, "dm"),
        eq(channelParticipant.userId, user.id),
        ...(workspaceId ? [eq(channelTable.workspaceId, workspaceId)] : [])
      )
    )
    .orderBy(desc(channelTable.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (firstDm) {
    redirect(`/chat/${firstDm.id}`);
  }

  redirect("/home");
}
