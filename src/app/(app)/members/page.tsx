import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  membership,
  task as taskTable,
} from "@drizzle/schema";
import { eq, desc, asc, inArray, and, ne } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/messages";
import { Icon } from "@/shared/ui";
import {
  MemberDirectoryCard,
  type DirectoryMember,
} from "./MemberDirectoryCard";

interface RawMember {
  id: string;
  name: string;
  role: string;
  projectRole: string | null;
  seniority: string | null;
  status: string;
  joinedAt: Date;
  isYou: boolean;
}

function roleLabel(role: string, locale: "es" | "en"): string {
  if (role === "leader") return locale === "es" ? "Líder" : "Leader";
  if (role === "admin") return "Admin";
  return locale === "es" ? "Miembro" : "Member";
}

function seniorityLabel(seniority: string | null, locale: "es" | "en"): string {
  if (!seniority) return "";
  return t(locale, `directory.seniority.${seniority}`, {});
}

function availabilityLabel(status: string, locale: "es" | "en"): string {
  return t(locale, `directory.availabilityState.${status}`, {});
}

function formatJoined(date: Date, locale: "es" | "en"): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

  const locale = (await getLocale()) as "es" | "en";

  const rows = await db
    .select({
      id: membership.userId,
      name: userTable.name,
      role: membership.role,
      projectRole: membership.projectRole,
      seniority: membership.seniority,
      status: membership.status,
      joinedAt: membership.joinedAt,
    })
    .from(membership)
    .leftJoin(userTable, eq(userTable.id, membership.userId))
    .where(eq(membership.workspaceId, active.workspaceId))
    .orderBy(desc(membership.role), asc(membership.joinedAt));

  const rawMembers: RawMember[] = rows.map((m) => ({
    id: m.id!,
    name: m.name ?? "Someone",
    role: m.role ?? "member",
    projectRole: m.projectRole,
    seniority: m.seniority,
    status: m.status ?? "active",
    joinedAt: m.joinedAt,
    isYou: m.id === user.id,
  }));

  const memberIds = rawMembers.map((m) => m.id);

  const taskRows = memberIds.length
    ? await db
        .select({
          userId: taskTable.userId,
          status: taskTable.status,
          worked: taskTable.workedMinutes,
        })
        .from(taskTable)
        .where(
          and(inArray(taskTable.userId, memberIds), ne(taskTable.userId, ""))
        )
    : [];

  const statsByUser = new Map<
    string,
    { active: number; completed: number; worked: number }
  >();
  for (const r of taskRows) {
    const cur = statsByUser.get(r.userId) ?? { active: 0, completed: 0, worked: 0 };
    const isDone = r.status === "done" || r.status === "completed";
    if (isDone) cur.completed += 1;
    else cur.active += 1;
    cur.worked += r.worked ?? 0;
    statsByUser.set(r.userId, cur);
  }

  const members: DirectoryMember[] = rawMembers.map((m) => {
    const s = statsByUser.get(m.id) ?? { active: 0, completed: 0, worked: 0 };
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      projectRole: m.projectRole,
      seniority: seniorityLabel(m.seniority, locale),
      status: m.status,
      joinedAt: formatJoined(m.joinedAt, locale),
      isYou: m.isYou,
      activeTasks: s.active,
      completedTasks: s.completed,
      workedMinutes: s.worked,
    };
  });

  const isLeader = active.role === "leader" || active.role === "admin";
  const countLabel =
    members.length === 1
      ? t(locale, "directory.oneMember")
      : t(locale, "directory.memberCount", { count: members.length });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-line px-6 py-5 pb-4 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Icon name="people" size={22} color="var(--color-accent)" />
          <h1 className="font-display text-2xl text-ink">
            {t(locale, "directory.title")}
          </h1>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          {active.workspaceEmoji ?? "🚀"} {active.workspaceName} ·{" "}
          <span className="font-mono text-ink-3">{active.workspaceHashtag}</span>{" "}
          · {countLabel}
        </p>
        <p className="mt-1 text-[13px] text-ink-3">
          {t(locale, "directory.subtitle")}
        </p>
      </div>

      <div className="px-6 py-5 pb-8 lg:px-8">
        {members.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[15px] text-ink-2">
              {t(locale, "directory.noMembers")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => (
              <MemberDirectoryCard
                key={m.id}
                member={m}
                workspaceId={active.workspaceId}
                isLeader={isLeader}
                labels={{
                  roleLabel: roleLabel(m.role, locale),
                  projectRole: m.projectRole ?? "",
                  seniority: m.seniority,
                  responsibilities: t(locale, "directory.responsibilities"),
                  workload: t(locale, "directory.workload"),
                  activeTasks: t(locale, "directory.activeTasks"),
                  completedTasks: t(locale, "directory.completedTasks"),
                  workedHours: t(locale, "directory.workedHours"),
                  viewProfile: t(locale, "directory.viewProfile"),
                  assignTask: t(locale, "directory.assignTask"),
                  sendMessage: t(locale, "directory.sendMessage"),
                  sendMessageHint: t(locale, "directory.sendMessageHint"),
                  openDmError: t(locale, "directory.openDmError"),
                  joined: t(locale, "directory.joined", { date: m.joinedAt }),
                  availability: t(locale, "directory.availability"),
                  availabilityState: availabilityLabel(m.status, locale),
                  youLabel: t(locale, "nav.you"),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
