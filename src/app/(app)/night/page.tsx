import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, userProfile, userMetric } from "@drizzle/schema";
import { eq, and, count, gte } from "drizzle-orm";
import { weekAgo } from "@/server/lib/dates";
import { NightClient } from "./NightClient";

export default async function NightPage() {
  const session = await getServerSession(authOptions);
  const user = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      tone: userProfile.tone,
    })
    .from(userTable)
    .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
    .where(eq(userTable.email, session?.user?.email ?? ""))
    .then((r) => r[0] ?? null);

  const warm = user?.tone === "balanced" ? false : true;
  const name = user?.name?.split(" ")[0] ?? "Maya";

  const since = weekAgo();
  const windDownsThisWeek = user
    ? (
        await db
          .select({ c: count() })
          .from(userMetric)
          .where(
            and(
              eq(userMetric.userId, user.id),
              eq(userMetric.type, "wind_down"),
              gte(userMetric.date, since)
            )
          )
      )[0]?.c ?? 0
    : 0;

  return (
    <NightClient
      warm={warm}
      name={name}
      windDownsThisWeek={windDownsThisWeek}
    />
  );
}
