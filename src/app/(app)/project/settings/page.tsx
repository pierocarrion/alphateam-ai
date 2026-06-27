import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, workspace as workspaceTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { ProjectSettingsModule } from "@/features/project-settings/presentation/components/ProjectSettingsModule";

export default async function ProjectSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  if (active.role !== "leader" && active.role !== "admin") {
    redirect("/home");
  }

  const workspace = await db.query.workspace.findFirst({
    where: eq(workspaceTable.id, active.workspaceId),
    columns: { id: true, name: true, emoji: true },
  });
  if (!workspace) redirect("/home");

  return (
    <ProjectSettingsModule
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      workspaceEmoji={workspace.emoji}
    />
  );
}
