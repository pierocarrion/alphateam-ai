import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { weekAgo } from "@/server/lib/dates";
import { NightClient } from "./NightClient";

export default async function NightPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    include: { profile: true },
  });

  const warm = user?.profile?.tone === "balanced" ? false : true;
  const name = user?.name?.split(" ")[0] ?? "Maya";

  const since = weekAgo();
  const windDownsThisWeek = user
    ? await prisma.userMetric.count({
        where: { userId: user.id, type: "wind_down", date: { gte: since } },
      })
    : 0;

  return (
    <NightClient
      warm={warm}
      name={name}
      windDownsThisWeek={windDownsThisWeek}
    />
  );
}
