import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  userProfile,
  membership as membershipTable,
  workspace as workspaceTable,
} from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
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

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
  });
  if (!user) redirect("/login");

  const profile = await db.query.userProfile.findFirst({
    where: eq(userProfile.userId, user.id),
  });

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, user.id),
      eq(membershipTable.workspaceId, active.workspaceId)
    ),
    columns: { role: true },
  });
  const isLeader = membership?.role === "leader" || membership?.role === "admin";
  if (!isLeader) redirect("/crew");

  const goals = await container.goalProgressRepository.listForWorkspace(
    active.workspaceId
  );
  const workspace = await db.query.workspace.findFirst({
    where: eq(workspaceTable.id, active.workspaceId),
    columns: { name: true, emoji: true },
  });

  const warm = profile?.tone !== "balanced";
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
