import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  membership,
} from "@drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { Avatar, Icon } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import type { PersonId } from "@/shared/ui";

interface MemberRow {
  id: string;
  name: string;
  role: string;
  joinedAt: Date;
  isYou: boolean;
}

function roleLabel(role: string): string {
  if (role === "leader") return "Líder";
  if (role === "admin") return "Admin";
  return "Miembro";
}

export default async function MembersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const memberships = await db
    .select({
      userId: membership.userId,
      userName: userTable.name,
      role: membership.role,
      joinedAt: membership.joinedAt,
    })
    .from(membership)
    .leftJoin(userTable, eq(userTable.id, membership.userId))
    .where(eq(membership.workspaceId, active.workspaceId))
    .orderBy(desc(membership.role), asc(membership.joinedAt));

  const members: MemberRow[] = memberships.map((m) => ({
    id: m.userId,
    name: m.userName ?? "Someone",
    role: m.role,
    joinedAt: m.joinedAt,
    isYou: m.userId === user.id,
  }));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-line px-6 py-5 pb-4 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Icon name="people" size={22} color="var(--color-accent)" />
          <h1 className="font-display text-2xl text-ink">Miembros</h1>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          {active.workspaceEmoji ?? "🚀"} {active.workspaceName} ·{" "}
          <span className="font-mono text-ink-3">{active.workspaceHashtag}</span>{" "}
          · {members.length} {members.length === 1 ? "persona" : "personas"}
        </p>
      </div>

      <div className="px-6 py-5 pb-8 lg:px-8">
        {members.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[15px] text-ink-2">
              Todavía no hay miembros en este proyecto.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {members.map((m, i) => {
              const who = personIdFromName(m.name) as PersonId;
              const role = roleLabel(m.role);
              return (
                <Link
                  key={m.id}
                  href={`/profile/${m.id}`}
                  className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/[0.03] ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <Avatar who={who} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold text-ink">
                        {m.name}
                      </span>
                      {m.isYou && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                          tú
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-3">
                      Se unió el {formatJoined(m.joinedAt)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      m.role === "leader" || m.role === "admin"
                        ? "bg-accent-soft text-accent"
                        : "bg-surface-2 text-ink-3"
                    }`}
                  >
                    {role}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatJoined(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
