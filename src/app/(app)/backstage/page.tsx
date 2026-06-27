import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { BackstageClient } from "./BackstageClient";

export default async function BackstagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active || (active.role !== "leader" && active.role !== "admin")) {
    redirect("/home");
  }

  return <BackstageClient />;
}
