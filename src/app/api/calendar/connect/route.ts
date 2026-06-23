import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/server/lib/auth";

const LINK_COOKIE = "gc_link_uid";
const LINK_TTL_SEC = 5 * 60;

/**
 * Prepares the "link Google account" flow for the signed-in user.
 *
 * The client POSTs here to drop a short-lived, httpOnly cookie identifying
 * the user, then immediately calls `signIn("google", { callbackUrl })`. The
 * NextAuth `signIn` callback reads this cookie to link the Google account to
 * the current user — even when the Google email differs from the account
 * email.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await parseBody(request);
  const callbackUrl = sanitizeCallbackUrl(body?.callbackUrl, new URL(request.url).origin);

  const cookieStore = await cookies();
  cookieStore.set({
    name: LINK_COOKIE,
    value: auth.user.id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LINK_TTL_SEC,
  });

  return NextResponse.json({ ok: true, callbackUrl });
}

async function parseBody(
  request: Request
): Promise<{ callbackUrl?: unknown } | null> {
  try {
    return (await request.json()) as { callbackUrl?: unknown };
  } catch {
    return null;
  }
}

function sanitizeCallbackUrl(raw: unknown, origin: string): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/settings";
  // Only allow same-origin relative paths.
  return `${origin}${raw}`;
}
