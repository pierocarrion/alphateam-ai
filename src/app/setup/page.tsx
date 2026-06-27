import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  userProfile,
  membership,
} from "@drizzle/schema";
import { eq, count } from "drizzle-orm";

export default async function SetupRouterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const [user] = await db.select({
    id: userTable.id,
    profileOnboarded: userProfile.onboarded,
    profileRole: userProfile.role,
    membershipCount: count(membership.id),
  })
    .from(userTable)
    .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
    .leftJoin(membership, eq(membership.userId, userTable.id))
    .where(eq(userTable.email, session.user.email))
    .groupBy(userTable.id, userProfile.id)
    .limit(1);

  if (!user) redirect("/login");

  // Already part of a project -> go to the app.
  if (Number(user.membershipCount) > 0) {
    redirect("/home");
  }

  if (!user.profileOnboarded) {
    redirect("/onboarding");
  }

  const role = user.profileRole ?? "";
  const isLeader =
    role.toLowerCase().includes("lead") || role.toLowerCase().includes("lider");

  redirect(isLeader ? "/setup/project" : "/setup/join");
}
