import { prisma } from "./prisma";

export interface ActiveWorkspace {
  workspaceId: string;
  workspaceName: string;
  workspaceEmoji: string | null;
  workspaceHashtag: string;
  role: string;
}

export interface ActiveWorkspaceResult {
  active: ActiveWorkspace | null;
  /**
   * All memberships of the user, so callers can render a switcher or fall
   * back without a second query.
   */
  memberships: {
    workspaceId: string;
    role: string;
    workspace: {
      id: string;
      name: string;
      emoji: string | null;
      hashtag: string;
    };
  }[];
}

/**
 * Resolves the user's active workspace.
 *
 * Selection order:
 *  1. `UserProfile.lastActiveWorkspaceId`, if the user is still a member.
 *  2. The first membership (oldest join) as a safe default.
 *
 * Returns `{ active: null }` when the user has no memberships yet — callers
 * should redirect to setup in that case.
 */
export async function getActiveWorkspace(userId: string): Promise<ActiveWorkspaceResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { select: { lastActiveWorkspaceId: true } },
      memberships: {
        orderBy: { joinedAt: "asc" },
        include: {
          workspace: {
            select: { id: true, name: true, emoji: true, hashtag: true },
          },
        },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    return { active: null, memberships: [] };
  }

  const lastId = user.profile?.lastActiveWorkspaceId ?? null;
  const matched = lastId
    ? user.memberships.find((m) => m.workspaceId === lastId)
    : undefined;
  const chosen = matched ?? user.memberships[0];

  return {
    active: {
      workspaceId: chosen.workspaceId,
      workspaceName: chosen.workspace.name,
      workspaceEmoji: chosen.workspace.emoji,
      workspaceHashtag: chosen.workspace.hashtag,
      role: chosen.role ?? "member",
    },
    memberships: user.memberships.map((m) => ({
      workspaceId: m.workspaceId,
      role: m.role,
      workspace: m.workspace,
    })),
  };
}

/**
 * Resolves everything the (app) layout needs in a single Prisma round-trip:
 * user identity + role flags + onboarding state + active workspace + all
 * memberships. Used to avoid the previous two sequential findUnique calls.
 */
export interface AppSession {
  userId: string;
  userName: string;
  globalRole: string | null;
  onboarded: boolean;
  active: ActiveWorkspace | null;
  memberships: ActiveWorkspaceResult["memberships"];
}

export async function resolveAppSessionByEmail(
  email: string
): Promise<AppSession | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: { select: { lastActiveWorkspaceId: true, onboarded: true } },
      memberships: {
        orderBy: { joinedAt: "asc" },
        include: {
          workspace: {
            select: { id: true, name: true, emoji: true, hashtag: true },
          },
        },
      },
    },
  });

  if (!user) return null;

  const lastId = user.profile?.lastActiveWorkspaceId ?? null;
  const matched = lastId
    ? user.memberships.find((m) => m.workspaceId === lastId)
    : undefined;
  const chosen = matched ?? user.memberships[0] ?? null;

  return {
    userId: user.id,
    userName: user.name ?? "you",
    globalRole: user.globalRole ?? null,
    onboarded: user.profile?.onboarded ?? false,
    active: chosen
      ? {
          workspaceId: chosen.workspaceId,
          workspaceName: chosen.workspace.name,
          workspaceEmoji: chosen.workspace.emoji,
          workspaceHashtag: chosen.workspace.hashtag,
          role: chosen.role ?? "member",
        }
      : null,
    memberships: user.memberships.map((m) => ({
      workspaceId: m.workspaceId,
      role: m.role,
      workspace: m.workspace,
    })),
  };
}

/**
 * Persists the user's active workspace choice. Silently ignores a missing
 * or non-member workspace so the client can switch optimistically.
 */
export async function setActiveWorkspace(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const member = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true },
  });
  if (!member) return false;

  await prisma.userProfile.update({
    where: { userId },
    data: { lastActiveWorkspaceId: workspaceId },
  });
  return true;
}
