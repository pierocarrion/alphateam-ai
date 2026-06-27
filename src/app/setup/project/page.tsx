import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, userProfile, membership } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { ProjectWizard } from "@/features/projects/presentation/components/ProjectWizard";

export default async function SetupProjectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  const [profile, memberships] = await Promise.all([
    db.query.userProfile.findFirst({
      where: eq(userProfile.userId, user.id),
      columns: { onboarded: true },
    }),
    db
      .select({ id: membership.id })
      .from(membership)
      .where(eq(membership.userId, user.id)),
  ]);

  if (!profile?.onboarded) redirect("/onboarding");
  // Already has a project -> straight to the app.
  if (memberships.length > 0) redirect("/home");

  return <ProjectWizard />;
}
