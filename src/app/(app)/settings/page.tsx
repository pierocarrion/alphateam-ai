import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    include: { profile: true },
  });

  const tone = user?.profile?.tone === "balanced" ? ("balanced" as const) : ("warm" as const);
  const gentleCheckIns = user?.profile?.gentleCheckIns ?? true;
  const pairStartInvites = user?.profile?.pairStartInvites ?? true;
  const quietMode = user?.profile?.quietMode ?? false;

  return (
    <SettingsClient
      tone={tone}
      gentleCheckIns={gentleCheckIns}
      pairStartInvites={pairStartInvites}
      quietMode={quietMode}
    />
  );
}
