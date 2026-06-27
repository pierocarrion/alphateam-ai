import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/lib/db";
import { workspace as workspaceTable, membership } from "@drizzle/schema";
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
  const ws = await db.query.workspace.findFirst({
    where: eq(workspaceTable.id, projectId),
    columns: { id: true },
  });
  if (!ws) {
    return {
      user: null,
      workspaceId: null,
      role: null,
      response: NextResponse.json({ error: MSG_NOT_FOUND }, { status: 404 }),
    };
  }

  const m = await db.query.membership.findFirst({
    where: and(
      eq(membership.userId, user.id),
      eq(membership.workspaceId, ws.id)
    ),
    columns: { role: true, status: true },
  });

  if (
    !m ||
    m.status !== "active" ||
    (m.role !== "member" && m.role !== "leader" && m.role !== "admin")
  ) {
    return {
      user: null,
      workspaceId: null,
      role: null,
      response: NextResponse.json({ error: MSG_FORBIDDEN }, { status: 403 }),
    };
  }

  return { user, workspaceId: ws.id, role: m.role, response: null };
}

export function isLeaderOrAdmin(role: string): boolean {
  return role === "leader" || role === "admin";
}

export { MSG_SIGN_IN };
