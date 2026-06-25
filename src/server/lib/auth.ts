import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "./prisma";

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
  let user = null as null | { id: string; email: string | null };
  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
  }
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });
  }

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: MSG_NO_ACCOUNT }, { status: 404 }),
    };
  }

  return { user, response: null };
}

export function isPrismaConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return false;
  return ["P1001", "P1002", "P1008", "P2024"].includes(code);
}
