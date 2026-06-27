import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { container } from "@/server/lib/container";
import { ProgressClient } from "./ProgressClient";

/**
 * Leader "Progress" section. Resolves the active workspace, gates access to
 * leaders/admins, and hands the most recent active goal to the client tracker.
 */
export default async function ProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profile: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: active.workspaceId },
    },
    select: { role: true },
  });
  const isLeader = membership?.role === "leader" || membership?.role === "admin";
  if (!isLeader) redirect("/crew");

  const goals = await container.goalProgressRepository.listForWorkspace(
    active.workspaceId
  );
  const workspace = await prisma.workspace.findUnique({
    where: { id: active.workspaceId },
    select: { name: true, emoji: true },
  });

  const warm = user.profile?.tone !== "balanced";
  const activeGoal = goals.find((g) => g.status === "active") ?? goals[0] ?? null;

  return (
    <ProgressClient
      warm={warm}
      workspaceId={active.workspaceId}
      projectName={workspace?.name ?? "Proyecto"}
      projectEmoji={workspace?.emoji ?? null}
      goals={goals.map((g) => ({
        id: g.id,
        title: g.title,
        status: g.status,
        deadline: g.deadline ? g.deadline.toISOString() : null,
      }))}
      initialGoalId={activeGoal?.id ?? null}
    />
  );
}
