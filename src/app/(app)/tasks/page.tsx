import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, membership } from "@drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { Icon } from "@/shared/ui";
import { TasksBoard } from "@/features/project-tasks/presentation/components/TasksBoard";
import type { ProjectMemberOption } from "@/features/project-tasks/presentation/types";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/messages";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const rows = await db
    .select({
      role: membership.role,
      userId: userTable.id,
      userName: userTable.name,
      joinedAt: membership.joinedAt,
    })
    .from(membership)
    .leftJoin(userTable, eq(userTable.id, membership.userId))
    .where(
      and(
        eq(membership.workspaceId, active.workspaceId),
        eq(membership.status, "active")
      )
    )
    .orderBy(desc(membership.role), asc(membership.joinedAt));

  const members: ProjectMemberOption[] = rows.map((m) => ({
    id: m.userId!,
    name: m.userName ?? "Someone",
    role: m.role,
    isYou: m.userId === user.id,
  }));

  const isLeader = active.role === "leader" || active.role === "admin";
  const locale = await getLocale();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-line px-6 py-5 pb-4 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Icon name="target" size={22} color="var(--color-accent)" />
          <h1 className="font-display text-2xl text-ink">{t(locale, "tasks.title")}</h1>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          {active.workspaceEmoji ?? "🚀"} {active.workspaceName} ·{" "}
          <span className="font-mono text-ink-3">{active.workspaceHashtag}</span>
          {" · "}
          {t(locale, isLeader ? "tasks.leaderSub" : "tasks.memberSub")}
        </p>
      </div>

      <TasksBoard
        workspaceId={active.workspaceId}
        members={members}
        currentUserId={user.id}
        isLeader={isLeader}
      />
    </div>
  );
}
