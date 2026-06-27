import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, userProfile, task } from "@drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { DayClient } from "./DayClient";

export default async function DayPage() {
  const session = await getServerSession(authOptions);
  const user = await db
    .select({
      id: userTable.id,
      tone: userProfile.tone,
    })
    .from(userTable)
    .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
    .where(eq(userTable.email, session?.user?.email ?? ""))
    .then((r) => r[0] ?? null);

  const warm = user?.tone === "balanced" ? false : true;

  const tasks = await db.query.task.findMany({
    where: user
      ? and(eq(task.userId, user.id), eq(task.status, "open"))
      : eq(task.status, "open"),
    orderBy: [desc(task.priority), desc(task.createdAt)],
    columns: { id: true, title: true, micro: true },
    limit: 5,
  });

  const heroTask = tasks[0] ?? null;
  const otherTasks = tasks.slice(1);

  return <DayClient heroTask={heroTask} otherTasks={otherTasks} warm={warm} />;
}
