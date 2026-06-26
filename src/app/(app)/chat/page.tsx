import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  // Scope the default channel to the active workspace only, so the index
  // never drops the user into a channel of a different project.
  const active = await getActiveWorkspace(user.id);
  const workspaceId = active.active?.workspaceId;

  const firstChannel = await prisma.channel.findFirst({
    where: {
      type: "channel",
      ...(workspaceId
        ? { workspaceId }
        : { workspace: { memberships: { some: { userId: user.id } } } }),
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  if (firstChannel) {
    redirect(`/chat/${firstChannel.id}`);
  }

  const firstDm = await prisma.channel.findFirst({
    where: {
      type: "dm",
      ...(workspaceId
        ? { workspaceId, participants: { some: { userId: user.id } } }
        : { participants: { some: { userId: user.id } } }),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (firstDm) {
    redirect(`/chat/${firstDm.id}`);
  }

  redirect("/home");
}
