import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { MobileNav } from "@/features/auth/presentation/components/MobileNav";
import {
  DesktopSidebar,
  type SidebarChannel,
  type SidebarMember,
} from "@/features/navigation/components/DesktopSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profile: true,
      memberships: { include: { workspace: true } },
    },
  });

  if (!user?.profile?.onboarded) {
    redirect("/onboarding");
  }

  const primaryMembership = user.memberships[0];

  // No project yet -> route the user to setup (create or join based on role).
  if (!primaryMembership) {
    redirect("/setup");
  }

  const workspace = primaryMembership.workspace;
  const userRole = primaryMembership.role ?? "member";

  let channels: SidebarChannel[] = [];
  let members: SidebarMember[] = [];
  let dmByPeer: Record<string, string> = {};
  let workspaceName = "Mi proyecto";
  let pendingRequests = 0;

  if (workspace) {
    const [workspaceChannels, workspaceMembers, dmChannels, pending] =
      await Promise.all([
        prisma.channel.findMany({
          where: { workspaceId: workspace.id, type: "channel" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.membership.findMany({
          where: {
            workspaceId: workspace.id,
            userId: { not: user.id },
          },
          include: { user: { select: { id: true, name: true } } },
        }),
        prisma.channel.findMany({
          where: {
            workspaceId: workspace.id,
            type: "dm",
            participants: { some: { userId: user.id } },
          },
          include: {
            participants: { select: { userId: true } },
          },
        }),
        (userRole === "leader" || userRole === "admin")
          ? prisma.joinRequest.count({
              where: { workspaceId: workspace.id, status: "pending" },
            })
          : Promise.resolve(0),
      ]);

    channels = workspaceChannels;
    members = workspaceMembers.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? "Someone",
    }));
    workspaceName = workspace.name;
    pendingRequests = pending;
    dmByPeer = {};
    for (const c of dmChannels) {
      const peerId = c.participants.find((p) => p.userId !== user.id)?.userId;
      if (peerId) dmByPeer[peerId] = c.id;
    }
  }

  const showBackstage = userRole === "leader" || userRole === "admin";

  return (
    <div className="flex h-full flex-1">
      {/* Desktop sidebar */}
      <DesktopSidebar
        workspaceName={workspaceName}
        workspaceEmoji={workspace?.emoji}
        workspaceHashtag={workspace?.hashtag}
        channels={channels}
        members={members}
        dmByPeer={dmByPeer}
        userName={user.name ?? "you"}
        userRole={userRole}
        showBackstage={showBackstage}
        pendingRequests={pendingRequests}
      />

      {/* Main area + mobile nav */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-hidden">{children}</main>
        <div className="lg:hidden">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}
