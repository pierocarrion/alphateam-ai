import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { resolveAppSessionByEmail } from "@/server/lib/activeWorkspace";
import { MobileNav } from "@/features/auth/presentation/components/MobileNav";
import {
  DesktopSidebar,
  type SidebarChannel,
  type SidebarMember,
  type SidebarWorkspace,
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

  const appSession = await resolveAppSessionByEmail(session.user.email);

  if (!appSession) {
    redirect("/login");
  }

  // Un super-admin siempre pertenece al panel de administración, no al flujo
  // normal de la app.
  if (appSession.globalRole === "superadmin") {
    redirect("/admin");
  }

  if (!appSession.onboarded) {
    redirect("/onboarding");
  }

  const { active, memberships } = appSession;

  // No project yet -> route the user to setup (create or join based on role).
  if (!active) {
    redirect("/setup");
  }

  const workspaceId = active.workspaceId;
  const userRole = active.role;
  const userId = appSession.userId;

  const [workspaceChannels, workspaceMembers, dmChannels, pending] =
    await Promise.all([
      prisma.channel.findMany({
        where: { workspaceId, type: "channel" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.membership.findMany({
        where: {
          workspaceId,
          userId: { not: userId },
        },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.channel.findMany({
        where: {
          workspaceId,
          type: "dm",
          participants: { some: { userId } },
        },
        include: {
          participants: { select: { userId: true } },
        },
      }),
      (userRole === "leader" || userRole === "admin")
        ? prisma.joinRequest.count({
            where: { workspaceId, status: "pending" },
          })
        : Promise.resolve(0),
    ]);

  const channels: SidebarChannel[] = workspaceChannels;
  const members: SidebarMember[] = workspaceMembers.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? "Someone",
  }));
  const dmByPeer: Record<string, string> = {};
  for (const c of dmChannels) {
    const peerId = c.participants.find((p) => p.userId !== userId)?.userId;
    if (peerId) dmByPeer[peerId] = c.id;
  }

  const workspaces: SidebarWorkspace[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    emoji: m.workspace.emoji,
    hashtag: m.workspace.hashtag,
  }));

  const showBackstage = userRole === "leader" || userRole === "admin";

  return (
    <div className="flex h-full flex-1">
      {/* Desktop sidebar */}
      <DesktopSidebar
        workspaceId={workspaceId}
        workspaceName={active.workspaceName}
        workspaceEmoji={active.workspaceEmoji}
        workspaceHashtag={active.workspaceHashtag}
        channels={channels}
        members={members}
        dmByPeer={dmByPeer}
        workspaces={workspaces}
        currentUserId={userId}
        userName={appSession.userName}
        userRole={userRole}
        showBackstage={showBackstage}
        pendingRequests={pending}
      />

      {/* Main area + mobile nav */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="relative flex-1 overflow-hidden">{children}</main>
        <div className="lg:hidden">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}
