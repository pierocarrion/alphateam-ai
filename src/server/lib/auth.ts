import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "./db";
import { user } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { toSemanticDbError } from "./dbErrors";

const MSG_SIGN_IN = "Please sign in to continue.";
const MSG_NO_ACCOUNT = "We couldn't find your account. Please sign in again.";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface RequireUserResult {
  user: AuthUser;
  response: null;
}

export interface RequireUserErrorResponse {
  user: null;
  response: NextResponse;
}

export async function requireUser(): Promise<RequireUserResult | RequireUserErrorResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      user: null,
      response: NextResponse.json({ error: MSG_SIGN_IN }, { status: 401 }),
    };
  }

  // Prefer the authoritative user id from the JWT (set in the session callback)
  // over the email, because a linked Google account may carry an email that
  // differs from — or even collides with — another user's email.
  const userId = (session.user as { id?: string }).id;
  let userRow = null as null | { id: string; email: string | null };
  if (userId) {
    userRow = (await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, email: true },
    })) ?? null;
  }
  if (!userRow) {
    userRow = (await db.query.user.findFirst({
      where: eq(user.email, session.user.email),
      columns: { id: true, email: true },
    })) ?? null;
  }

  if (!userRow) {
    return {
      user: null,
      response: NextResponse.json({ error: MSG_NO_ACCOUNT }, { status: 404 }),
    };
  }

  return { user: userRow, response: null };
}

export function isPrismaConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && ["P1001", "P1002", "P1008", "P2024"].includes(code)) {
    return true;
  }
  const semantic = toSemanticDbError(error);
  if (semantic && semantic.code === "P2024") {
    return true;
  }
  return false;
}
