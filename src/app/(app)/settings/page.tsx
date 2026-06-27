import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, userProfile } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { isGoogleConnected } from "@/server/services/googleCalendar";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session?.user?.email ?? ""),
    columns: { id: true },
  });
  const profile = user
    ? await db.query.userProfile.findFirst({
        where: eq(userProfile.userId, user.id),
      })
    : null;

  const tone = profile?.tone === "balanced" ? ("balanced" as const) : ("warm" as const);
  const gentleCheckIns = profile?.gentleCheckIns ?? true;
  const pairStartInvites = profile?.pairStartInvites ?? true;
  const quietMode = profile?.quietMode ?? false;
  const googleConnected = user ? await isGoogleConnected(user.id) : false;

  return (
    <SettingsClient
      tone={tone}
      gentleCheckIns={gentleCheckIns}
      pairStartInvites={pairStartInvites}
      quietMode={quietMode}
      googleConnected={googleConnected}
    />
  );
}
