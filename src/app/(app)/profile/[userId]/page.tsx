import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { sumRecoveredMinutesThisWeek } from "@/server/lib/metrics";
import { isGoogleConnected } from "@/server/services/googleCalendar";
import {
  ContextMeetingProposal,
  GoogleCalendarConnect,
} from "@/features/calendar/presentation";
import { Avatar, Button } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import type { PersonId } from "@/shared/ui";

function roleLabel(role: string): string {
  if (role === "leader") return "Líder";
  if (role === "admin") return "Admin";
  return "Miembro";
}

function formatJoined(date: Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const viewer = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!viewer) redirect("/login");

  const { active } = await getActiveWorkspace(viewer.id);
  if (!active) redirect("/setup");

  const { userId } = await params;

  const profiled = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      profile: { select: { role: true } },
    },
  });

  if (!profiled) redirect("/home");

  // The profiled user's membership in the active workspace (also gates access:
  // you can only view profiles of people who share your active workspace).
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: active.workspaceId },
    },
    select: { role: true, joinedAt: true },
  });

  if (!membership) redirect("/home");

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

  const role = roleLabel(membership.role);
  const selfRole = profiled.profile?.role;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex items-center gap-2">
          <Link
            href="/members"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/[0.03] text-ink-2 transition-colors hover:bg-white/[0.06]"
            aria-label="Volver a miembros"
          >
            <span aria-hidden>←</span>
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
            Perfil
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
            <Avatar who={who} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-2xl text-ink">
                  {displayName}
                </h1>
                {isYou && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    tú
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
                <span className="text-xs text-ink-3">
                  en {active.workspaceEmoji ?? "🚀"} {active.workspaceName}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="font-display text-[22px] text-ink">
                {recoveredLabel}
              </div>
              <div className="text-xs text-ink-3">
                recuperados esta semana
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="font-display text-[15px] text-ink">
                {formatJoined(membership.joinedAt)}
              </div>
              <div className="text-xs text-ink-3">se unió al proyecto</div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="mt-5 flex flex-col gap-3">
          {selfRole && (
            <DetailRow label="Rol" value={selfRole} />
          )}
          <DetailRow
            label="Proyecto"
            value={`${active.workspaceEmoji ?? "🚀"} ${active.workspaceName}`}
          />
          <DetailRow
            label="Hashtag"
            value={active.workspaceHashtag}
            mono
          />
        </div>

        {isYou && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="ghost" href="/me">
              Tu espacio
            </Button>
            <Button variant="ghost" href="/settings">
              Ajustes
            </Button>
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
        className={`text-[14.5px] text-ink ${mono ? "font-mono" : "font-semibold"}`}
      >
        {value}
      </span>
    </div>
  );
}
