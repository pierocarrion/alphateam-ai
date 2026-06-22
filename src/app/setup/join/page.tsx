import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { ProjectSearch } from "@/features/projects/presentation/components/ProjectSearch";

export default async function SetupJoinPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profile: true, memberships: { select: { id: true } } },
  });
  if (!user) redirect("/login");
  if (!user.profile?.onboarded) redirect("/onboarding");
  if (user.memberships.length > 0) redirect("/home");

  return <ProjectSearch />;
}
