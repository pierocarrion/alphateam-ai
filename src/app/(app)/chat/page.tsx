import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { computeLoadBalance, computeWorkspaceMood } from "@/server/lib/metrics";
import { personIdFromName } from "@/shared/lib/person";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { slug: "acme" },
    include: {
      channels: { where: { name: "q3-launch" }, take: 1 },
      memberships: { where: { userId: user.id } },
    },
  });

  const channel = workspace?.channels[0];
  if (!channel || !workspace?.memberships.length) redirect("/home");

  const mood = await computeWorkspaceMood(workspace.id);
  const load = await computeLoadBalance(workspace.id);
  const loadGuardian = load.heavy
    ? {
        who: personIdFromName(load.heavy.name),
        title: `${load.heavy.name} is carrying the most — ${load.heavy.openCount} open task${load.heavy.openCount === 1 ? "" : "s"}.`,
        note: "Suggest a pair‑start or hand one item over?",
      }
    : null;

  return (
    <ChatClient
      channelId={channel.id}
      channelName={channel.name}
      mood={mood}
      loadGuardian={loadGuardian}
    />
  );
}
