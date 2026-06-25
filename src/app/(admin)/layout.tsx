import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminTopBar } from "@/features/admin/components/AdminTopBar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      globalRole: true,
      blocked: true,
    },
  });

  if (!user || user.blocked || user.globalRole !== "superadmin") {
    redirect("/login");
  }

  return (
    <div className="flex h-full flex-1 bg-bg">
      <AdminSidebar userName={user.name ?? user.email ?? "admin"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main className="relative flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
