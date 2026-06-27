import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  channel as channelTable,
  membership,
  channelParticipant,
} from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { computeLoadBalance, computeWorkspaceMood } from "@/server/lib/metrics";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { personIdFromName } from "@/shared/lib/person";
import { ChatClient } from "../ChatClient";

export default async function ChatChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  const { channelId } = await params;

  const channel = await db.query.channel.findFirst({
    where: eq(channelTable.id, channelId),
  });

  if (!channel) redirect("/home");

  const isDm = channel.type === "dm";

  const [workspaceMemberships, participantRows] = await Promise.all([
    db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.workspaceId, channel.workspaceId)),
    db
      .select({ userId: channelParticipant.userId, userName: userTable.name })
      .from(channelParticipant)
      .leftJoin(userTable, eq(userTable.id, channelParticipant.userId))
      .where(eq(channelParticipant.channelId, channelId)),
  ]);

  const isMember = isDm
    ? participantRows.some((p) => p.userId === user.id)
    : workspaceMemberships.some((m) => m.userId === user.id);

  if (!isMember) redirect("/home");

  // Make sure the channel belongs to the user's *active* workspace; if the
  // user just switched projects the URL may still reference a channel from
  // the previous project, so send them to the new project's chat index.
  const active = await getActiveWorkspace(user.id);
  if (active.active && channel.workspaceId !== active.active.workspaceId) {
    redirect("/chat");
  }

  const peer = isDm
    ? participantRows.find((p) => p.userId !== user.id) ?? null
    : null;

  const mood = isDm
    ? { value: 0.5, label: "Private", note: "Just the two of you." }
    : await computeWorkspaceMood(channel.workspaceId);

  const load = isDm ? null : await computeLoadBalance(channel.workspaceId);
  const loadGuardian = load?.heavy
    ? {
        who: personIdFromName(load.heavy.name),
        title: `${load.heavy.name} is carrying the most — ${load.heavy.openCount} open task${load.heavy.openCount === 1 ? "" : "s"}.`,
        note: "Suggest a pair‑start or hand one item over?",
      }
    : null;

  return (
    <ChatClient
      channelId={channel.id}
      channelName={isDm ? (peer?.userName ?? "Direct message") : channel.name}
      channelType={isDm ? "dm" : "channel"}
      peerName={peer?.userName ?? null}
      mood={mood}
      loadGuardian={loadGuardian}
    />
  );
}
