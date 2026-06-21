import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const firstChannel = await prisma.channel.findFirst({
    where: {
      type: "channel",
      workspace: { memberships: { some: { userId: user.id } } },
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
      participants: { some: { userId: user.id } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (firstDm) {
    redirect(`/chat/${firstDm.id}`);
  }

  redirect("/home");
}
