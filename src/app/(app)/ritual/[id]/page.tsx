import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, task as taskTable } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { RitualClient } from "./RitualClient";

export default async function RitualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
  });
  if (!user) redirect("/login");

  const { id } = await params;
  const task = await db.query.task.findFirst({
    where: and(eq(taskTable.id, id), eq(taskTable.userId, user.id)),
  });
  if (!task) notFound();

  const warm = true; // TODO: read from profile tone

  return (
    <RitualClient
      task={{
        id: task.id,
        title: task.title,
        micro: task.micro,
        action: task.action,
        resource: task.resource,
        selfMade: task.selfMade,
      }}
      warm={warm}
    />
  );
}
