import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  userProfile,
  membership,
  workspace,
} from "@drizzle/schema";
import { eq, count } from "drizzle-orm";
import { ProjectSearch } from "@/features/projects/presentation/components/ProjectSearch";

export default async function SetupJoinPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const [user] = await db.select({
    id: userTable.id,
    profileOnboarded: userProfile.onboarded,
    membershipCount: count(membership.id),
  })
    .from(userTable)
    .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
    .leftJoin(membership, eq(membership.userId, userTable.id))
    .where(eq(userTable.email, session.user.email))
    .groupBy(userTable.id, userProfile.id)
    .limit(1);

  if (!user) redirect("/login");
  if (!user.profileOnboarded) redirect("/onboarding");
  if (Number(user.membershipCount) > 0) redirect("/home");

  const [{ c }] = await db.select({ c: count() }).from(workspace);

  return <ProjectSearch initialHasProjects={Number(c) > 0} />;
}
