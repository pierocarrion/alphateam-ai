import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { requireUser, type AuthUser } from "./auth";

const MSG_SIGN_IN = "Please sign in to continue.";
const MSG_FORBIDDEN = "No tienes acceso a este proyecto.";
const MSG_NOT_FOUND = "No encontramos ese proyecto.";

export interface RequireMemberResult {
  user: AuthUser;
  workspaceId: string;
  role: string;
  response: null;
}

export interface RequireMemberErrorResponse {
  user: null;
  workspaceId: null;
  role: null;
  response: NextResponse;
}

/**
 * Ensures the caller is authenticated AND is an active member of the project
 * identified by the route's `id` param. Returns workspace id + role on success.
 */
export async function requireProjectMember(
  rawProjectId: string
): Promise<RequireMemberResult | RequireMemberErrorResponse> {
  const auth = await requireUser();
  if (auth.response) {
    return { user: null, workspaceId: null, role: null, response: auth.response };
  }
  const user = auth.user;

  const projectId = decodeURIComponent(rawProjectId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!workspace) {
    return {
      user: null,
      workspaceId: null,
      role: null,
      response: NextResponse.json({ error: MSG_NOT_FOUND }, { status: 404 }),
    };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true, status: true },
  });

  if (
    !membership ||
    membership.status !== "active" ||
    (membership.role !== "member" && membership.role !== "leader" && membership.role !== "admin")
  ) {
    return {
      user: null,
      workspaceId: null,
      role: null,
      response: NextResponse.json({ error: MSG_FORBIDDEN }, { status: 403 }),
    };
  }

  return { user, workspaceId: workspace.id, role: membership.role, response: null };
}

export function isLeaderOrAdmin(role: string): boolean {
  return role === "leader" || role === "admin";
}

export { MSG_SIGN_IN };
