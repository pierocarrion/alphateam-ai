import { db } from "@/server/lib/db";
import {
  user as userTable,
  userProfile,
  membership as membershipTable,
  workspace as workspaceTable,
} from "@drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

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

interface MembershipRow {
  workspaceId: string;
  role: string;
  workspace: {
    id: string;
    name: string;
    emoji: string | null;
    hashtag: string;
  };
}

async function loadMemberships(userId: string): Promise<MembershipRow[]> {
  const rows = await db
    .select({
      workspaceId: membershipTable.workspaceId,
      role: membershipTable.role,
      wsId: workspaceTable.id,
      wsName: workspaceTable.name,
      wsEmoji: workspaceTable.emoji,
      wsHashtag: workspaceTable.hashtag,
    })
    .from(membershipTable)
    .leftJoin(workspaceTable, eq(workspaceTable.id, membershipTable.workspaceId))
    .where(eq(membershipTable.userId, userId))
    .orderBy(asc(membershipTable.joinedAt));

  return rows.map((r) => ({
    workspaceId: r.workspaceId,
    role: r.role,
    workspace: {
      id: r.wsId ?? r.workspaceId,
      name: r.wsName ?? "",
      emoji: r.wsEmoji ?? null,
      hashtag: r.wsHashtag ?? "",
    },
  }));
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
  const [userRow, memberships] = await Promise.all([
    db
      .select({ lastActiveWorkspaceId: userProfile.lastActiveWorkspaceId })
      .from(userTable)
      .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
      .where(eq(userTable.id, userId))
      .then((rows) => rows[0] ?? null),
    loadMemberships(userId),
  ]);

  if (!userRow || memberships.length === 0) {
    return { active: null, memberships: [] };
  }

  const lastId = userRow.lastActiveWorkspaceId ?? null;
  const matched = lastId
    ? memberships.find((m) => m.workspaceId === lastId)
    : undefined;
  const chosen = matched ?? memberships[0];

  return {
    active: {
      workspaceId: chosen.workspaceId,
      workspaceName: chosen.workspace.name,
      workspaceEmoji: chosen.workspace.emoji,
      workspaceHashtag: chosen.workspace.hashtag,
      role: chosen.role ?? "member",
    },
    memberships: memberships.map((m) => ({
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
  const [userRow, memberships] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        globalRole: userTable.globalRole,
        lastActiveWorkspaceId: userProfile.lastActiveWorkspaceId,
        onboarded: userProfile.onboarded,
      })
      .from(userTable)
      .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
      .where(eq(userTable.email, email))
      .then((rows) => rows[0] ?? null),
    loadMembershipsByEmail(email),
  ]);

  if (!userRow) return null;

  const lastId = userRow.lastActiveWorkspaceId ?? null;
  const matched = lastId
    ? memberships.find((m) => m.workspaceId === lastId)
    : undefined;
  const chosen = matched ?? memberships[0] ?? null;

  return {
    userId: userRow.id,
    userName: userRow.name ?? "you",
    globalRole: userRow.globalRole ?? null,
    onboarded: userRow.onboarded ?? false,
    active: chosen
      ? {
          workspaceId: chosen.workspaceId,
          workspaceName: chosen.workspace.name,
          workspaceEmoji: chosen.workspace.emoji,
          workspaceHashtag: chosen.workspace.hashtag,
          role: chosen.role ?? "member",
        }
      : null,
    memberships: memberships.map((m) => ({
      workspaceId: m.workspaceId,
      role: m.role,
      workspace: m.workspace,
    })),
  };
}

async function loadMembershipsByEmail(email: string): Promise<MembershipRow[]> {
  const userRow = await db.query.user.findFirst({
    where: eq(userTable.email, email),
    columns: { id: true },
  });
  if (!userRow) return [];
  return loadMemberships(userRow.id);
}

/**
 * Persists the user's active workspace choice. Silently ignores a missing
 * or non-member workspace so the client can switch optimistically.
 */
export async function setActiveWorkspace(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const member = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.workspaceId, workspaceId)
    ),
    columns: { id: true },
  });
  if (!member) return false;

  await db
    .update(userProfile)
    .set({ lastActiveWorkspaceId: workspaceId })
    .where(eq(userProfile.userId, userId));
  return true;
}
