import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, userProfile } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { OnboardingFlow } from "@/features/auth/presentation/components/OnboardingFlow";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const [row] = await db.select({
    id: userTable.id,
    profileOnboarded: userProfile.onboarded,
  })
    .from(userTable)
    .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
    .where(eq(userTable.email, session.user.email))
    .limit(1);

  if (row?.profileOnboarded) {
    redirect("/home");
  }

  return <OnboardingFlow />;
}
