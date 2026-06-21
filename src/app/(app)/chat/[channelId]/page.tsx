import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { computeLoadBalance, computeWorkspaceMood } from "@/server/lib/metrics";
import { personIdFromName } from "@/shared/lib/person";
import { ChatClient } from "../ChatClient";

export default async function ChatChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const { channelId } = await params;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: { include: { memberships: true } },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!channel) redirect("/home");

  const isDm = channel.type === "dm";
  const isMember = isDm
    ? channel.participants.some((p) => p.userId === user.id)
    : channel.workspace.memberships.some((m) => m.userId === user.id);

  if (!isMember) redirect("/home");

  const peer = isDm
    ? channel.participants.find((p) => p.userId !== user.id)?.user ?? null
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
      channelName={isDm ? (peer?.name ?? "Direct message") : channel.name}
      channelType={isDm ? "dm" : "channel"}
      peerName={peer?.name ?? null}
      mood={mood}
      loadGuardian={loadGuardian}
    />
  );
}
