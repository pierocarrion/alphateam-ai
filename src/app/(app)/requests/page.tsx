import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { JoinRequestsPanel } from "@/features/projects/presentation/components/JoinRequestsPanel";

export default async function RequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { memberships: true },
  });
  if (!user) redirect("/login");

  const membership = user.memberships[0];
  if (!membership || (membership.role !== "leader" && membership.role !== "admin")) {
    redirect("/home");
  }

  return <JoinRequestsPanel />;
}
