import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";

export default async function SetupRouterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profile: true,
      memberships: { select: { id: true } },
    },
  });

  if (!user) redirect("/login");

  // Already part of a project -> go to the app.
  if (user.memberships.length > 0) {
    redirect("/home");
  }

  if (!user.profile?.onboarded) {
    redirect("/onboarding");
  }

  const role = user.profile.role ?? "";
  const isLeader =
    role.toLowerCase().includes("lead") || role.toLowerCase().includes("lider");

  redirect(isLeader ? "/setup/project" : "/setup/join");
}
