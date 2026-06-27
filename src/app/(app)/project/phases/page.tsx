import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { PhaseTracker } from "@/features/project-phases/presentation/components/PhaseTracker";

export default async function ProjectPhasesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  if (active.role !== "leader" && active.role !== "admin") {
    redirect("/home");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: active.workspaceId },
    select: { id: true, name: true, emoji: true },
  });
  if (!workspace) redirect("/home");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
            Coordinación
          </div>
          <h1 className="mt-1 font-display text-2xl text-ink">
            Fases del proyecto
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-2">
            {workspace.emoji ?? "🚀"} {workspace.name} · base metodológica para arrancar,
            visual y opcional.
          </p>
        </div>
        <PhaseTracker workspaceId={workspace.id} />
      </div>
    </div>
  );
}
