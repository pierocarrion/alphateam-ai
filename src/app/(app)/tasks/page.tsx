import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { Icon } from "@/shared/ui";
import { TasksBoard } from "@/features/project-tasks/presentation/components/TasksBoard";
import type { ProjectMemberOption } from "@/features/project-tasks/presentation/types";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const memberships = await prisma.membership.findMany({
    where: { workspaceId: active.workspaceId, status: "active" },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
  });

  const members: ProjectMemberOption[] = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? "Someone",
    role: m.role,
    isYou: m.user.id === user.id,
  }));

  const isLeader = active.role === "leader" || active.role === "admin";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-line px-6 py-5 pb-4 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Icon name="target" size={22} color="var(--color-accent)" />
          <h1 className="font-display text-2xl text-ink">Tareas</h1>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          {active.workspaceEmoji ?? "🚀"} {active.workspaceName} ·{" "}
          <span className="font-mono text-ink-3">{active.workspaceHashtag}</span>
          {" · "}
          {isLeader
            ? "Asigná tareas al equipo o creá nuevas."
            : "Tomá tareas del proyecto o creá las tuyas."}
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
