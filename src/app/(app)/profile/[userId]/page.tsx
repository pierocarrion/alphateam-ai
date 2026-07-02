import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  userProfile,
  membership as membershipTable,
  task as taskTable,
} from "@drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { sumRecoveredMinutesThisWeek } from "@/server/lib/metrics";
import { isGoogleConnected } from "@/server/services/googleCalendar";
import {
  ContextMeetingProposal,
  GoogleCalendarConnect,
} from "@/features/calendar/presentation";
import { StartDmButton } from "@/features/navigation/components/StartDmButton";
import { Avatar, Icon } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import { presenceFromUserId, timezoneFromUserId } from "@/shared/lib/presence";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/messages";
import type { PersonId } from "@/shared/ui";

type Locale = "es" | "en";

function roleLabel(role: string, locale: Locale): string {
  if (role === "leader") return locale === "es" ? "Líder" : "Leader";
  if (role === "admin") return "Admin";
  return locale === "es" ? "Miembro" : "Member";
}

function formatJoined(date: Date, locale: Locale): string {
  return new Date(date).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface AssignedTask {
  id: string;
  title: string;
  status: string;
  category: string;
  priority: number | null;
  deadline: Date | null;
  completedAt: Date | null;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const viewer = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true },
  });
  if (!viewer) redirect("/login");

  const { active } = await getActiveWorkspace(viewer.id);
  if (!active) redirect("/setup");

  const locale = (await getLocale()) as Locale;
  const { userId } = await params;

  const profiled = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { id: true, name: true, email: true, createdAt: true },
  });

  if (!profiled) redirect("/home");

  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.workspaceId, active.workspaceId)
    ),
    columns: {
      role: true,
      projectRole: true,
      seniority: true,
      status: true,
      photoUrl: true,
      joinedAt: true,
    },
  });

  if (!membership) redirect("/home");

  const profiledProfile = await db.query.userProfile.findFirst({
    where: eq(userProfile.userId, userId),
    columns: { role: true },
  });

  const taskRows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      status: taskTable.status,
      category: taskTable.category,
      priority: taskTable.priority,
      deadline: taskTable.deadline,
      completedAt: taskTable.completedAt,
      workedMinutes: taskTable.workedMinutes,
      createdAt: taskTable.createdAt,
    })
    .from(taskTable)
    .where(eq(taskTable.userId, userId))
    .orderBy(desc(taskTable.createdAt));

  const isYou = profiled.id === viewer.id;
  const who = personIdFromName(profiled.name ?? "Someone") as PersonId;
  const displayName = profiled.name ?? "Someone";
  const minutes = await sumRecoveredMinutesThisWeek(profiled.id);
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  const recoveredLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const [viewerConnected, expertConnected] = await Promise.all([
    isGoogleConnected(viewer.id),
    isGoogleConnected(profiled.id),
  ]);

  const role = roleLabel(membership.role, locale);
  const selfRole = profiledProfile?.role;
  const presence = presenceFromUserId(profiled.id, membership.status);
  const timezone = timezoneFromUserId(profiled.id);
  const contactEmail = profiled.email ?? null;

  const activeTasks = taskRows.filter(
    (task) => task.status !== "done" && task.status !== "completed"
  ).length;
  const completedTasks = taskRows.filter(
    (task) => task.status === "done" || task.status === "completed"
  ).length;
  const workedMinutes = taskRows.reduce((sum, task) => sum + (task.workedMinutes ?? 0), 0);
  const workedHours = Math.round((workedMinutes / 60) * 10) / 10;
  const totalTasks = taskRows.length;
  const progressPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const assignedTasks: AssignedTask[] = taskRows.slice(0, 6).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    category: t.category,
    priority: t.priority,
    deadline: t.deadline,
    completedAt: t.completedAt,
  }));

  const isLeader = active.role === "leader" || active.role === "admin";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex items-center gap-2">
          <Link
            href="/members"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/[0.03] text-ink-2 transition-colors hover:bg-white/[0.06]"
            aria-label={t(locale, "directory.title")}
          >
            <span aria-hidden>←</span>
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
            {t(locale, "directory.viewProfile")}
          </span>
        </div>

        {/* Header card */}
        <div
          className="overflow-hidden rounded-[24px] border border-line-2 p-6"
          style={{
            background:
              "linear-gradient(160deg, var(--color-accent-soft), transparent)",
          }}
        >
          <div className="flex items-center gap-4">
            <Avatar who={who} size={64} status={presence} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-2xl text-ink">
                  {displayName}
                </h1>
                {isYou && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    {t(locale, "nav.you")}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    membership.role === "leader" || membership.role === "admin"
                      ? "bg-accent-soft text-accent"
                      : "bg-surface-2 text-ink-3"
                  }`}
                >
                  {role}
                </span>
                {membership.projectRole && (
                  <span className="text-xs text-ink-2">
                    {membership.projectRole}
                  </span>
                )}
                <span className="text-xs text-ink-3">
                  {locale === "es" ? "en" : "in"}{" "}
                  {active.workspaceEmoji ?? "🚀"} {active.workspaceName}
                </span>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi value={String(activeTasks)} label={t(locale, "directory.activeTasks")} />
            <Kpi value={String(completedTasks)} label={t(locale, "directory.completedTasks")} />
            <Kpi value={`${workedHours}h`} label={t(locale, "directory.workedHours")} />
            <Kpi value={recoveredLabel} label={t(locale, "directory.recovered")} />
          </div>
        </div>

        {/* Quick actions */}
        {!isYou && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StartDmButton
              partnerId={profiled.id}
              workspaceId={active.workspaceId}
              label={t(locale, "directory.sendMessage")}
              errorLabel={t(locale, "directory.openDmError")}
              variant="primary"
              size="sm"
            />
            {isLeader && (
              <Link
                href={`/tasks?assignee=${profiled.id}`}
                className="inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-display font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] transition-colors hover:bg-white/[0.03] hover:text-ink"
              >
                <Icon name="target" size={16} color="currentColor" />
                {t(locale, "directory.assignTask")}
              </Link>
            )}
            <Link
              href="/team-insights"
              className="inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-display font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] transition-colors hover:bg-white/[0.03] hover:text-ink"
            >
              <Icon name="pulse" size={16} color="currentColor" />
              {t(locale, "directory.viewActivity")}
            </Link>
            <span className="text-xs text-ink-3">
              {t(locale, "directory.sendMessageHint")}
            </span>
          </div>
        )}

        {/* Details */}
        <div className="mt-5 flex flex-col gap-3">
          {(selfRole || membership.projectRole) && (
            <DetailRow
              label={t(locale, "directory.responsibilities")}
              value={
                [selfRole, membership.projectRole]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
          )}
          {membership.seniority && (
            <DetailRow
              label={t(locale, "directory.seniority")}
              value={t(locale, `directory.seniority.${membership.seniority}`)}
            />
          )}
          <DetailRow
            label={t(locale, "directory.availability")}
            value={t(locale, `directory.availabilityState.${membership.status}`)}
          />
          <DetailRow label={t(locale, "directory.timezone")} value={timezone} />
          <DetailRow label={t(locale, "directory.contact")} value={contactEmail ?? "—"} mono />
          <DetailRow
            label={locale === "es" ? "Progreso" : "Progress"}
            value={`${progressPct}%`}
          />
          <DetailRow
            label={locale === "es" ? "Se unió" : "Joined"}
            value={formatJoined(membership.joinedAt, locale)}
          />
        </div>

        {/* Assigned tasks */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              {t(locale, "directory.assignedTasks")}
            </h2>
            <Link
              href="/tasks"
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t(locale, "nav.tasks")}
            </Link>
          </div>
          {assignedTasks.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-5 text-center text-[14px] text-ink-3">
              {t(locale, "directory.noTasks")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {assignedTasks.map((task) => {
                const done =
                  task.status === "done" || task.status === "completed";
                return (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] ${
                        done
                          ? "bg-[#4ec27a]/15 text-[#4ec27a]"
                          : "bg-surface-2 text-ink-3"
                      }`}
                    >
                      {done ? "✓" : "•"}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[14px] ${
                        done ? "text-ink-3 line-through" : "font-medium text-ink"
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="flex-none rounded-full bg-bg-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-3">
                      {task.category}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {isYou && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/me"
              className="inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-display font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] transition-colors hover:bg-white/[0.03] hover:text-ink"
            >
              {locale === "es" ? "Tu espacio" : "Your space"}
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-display font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] transition-colors hover:bg-white/[0.03] hover:text-ink"
            >
              {locale === "es" ? "Ajustes" : "Settings"}
            </Link>
          </div>
        )}

        {isYou ? (
          <div className="mt-4">
            <GoogleCalendarConnect initialConnected={viewerConnected} />
          </div>
        ) : (
          <div className="mt-6">
            <ContextMeetingProposal
              expertId={profiled.id}
              expertName={displayName}
              viewerConnected={viewerConnected}
              expertConnected={expertConnected}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="font-display text-[20px] text-ink">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      <span
        className={`text-[14.5px] text-ink ${mono ? "font-mono" : "font-semibold"} ${mono ? "break-all text-right" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
