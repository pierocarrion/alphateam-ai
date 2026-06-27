import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  channel as channelTable,
  membership,
  user as userTable,
  channelParticipant,
  joinRequest,
} from "@drizzle/schema";
import { eq, and, ne, asc, count, inArray } from "drizzle-orm";
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

  const [workspaceChannels, memberRows, dmRows, pending] = await Promise.all([
    db.query.channel.findMany({
      where: and(
        eq(channelTable.workspaceId, workspaceId),
        eq(channelTable.type, "channel")
      ),
      columns: { id: true, name: true },
      orderBy: asc(channelTable.name),
    }),
    db
      .select({
        userId: membership.userId,
        userName: userTable.name,
      })
      .from(membership)
      .leftJoin(userTable, eq(userTable.id, membership.userId))
      .where(
        and(
          eq(membership.workspaceId, workspaceId),
          ne(membership.userId, userId)
        )
      ),
    db
      .select({ id: channelTable.id })
      .from(channelTable)
      .innerJoin(
        channelParticipant,
        eq(channelParticipant.channelId, channelTable.id)
      )
      .where(
        and(
          eq(channelTable.workspaceId, workspaceId),
          eq(channelTable.type, "dm"),
          eq(channelParticipant.userId, userId)
        )
      ),
    (userRole === "leader" || userRole === "admin")
      ? db
          .select({ c: count() })
          .from(joinRequest)
          .where(
            and(
              eq(joinRequest.workspaceId, workspaceId),
              eq(joinRequest.status, "pending")
            )
          )
          .then((r) => r[0]?.c ?? 0)
      : Promise.resolve(0),
  ]);

  const dmIds = dmRows.map((r) => r.id);
  const dmParticipants = dmIds.length
    ? await db
        .select({
          channelId: channelParticipant.channelId,
          userId: channelParticipant.userId,
        })
        .from(channelParticipant)
        .where(inArray(channelParticipant.channelId, dmIds))
    : [];

  const channels: SidebarChannel[] = workspaceChannels;
  const members: SidebarMember[] = memberRows.map((m) => ({
    id: m.userId,
    name: m.userName ?? "Someone",
  }));
  const dmByPeer: Record<string, string> = {};
  for (const c of dmRows) {
    const peerId = dmParticipants.find(
      (p) => p.channelId === c.id && p.userId !== userId
    )?.userId;
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
        <main key={workspaceId} className="relative flex-1 overflow-hidden">{children}</main>
        <div className="lg:hidden">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}
