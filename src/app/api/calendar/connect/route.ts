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
  const callbackUrl = sanitizeCallbackUrl(
    body?.callbackUrl,
    resolveOrigin(request)
  );

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

/**
 * Resolves the public origin of the request.
 *
 * Behind Firebase Hosting -> Cloud Run, `request.url` is the *internal*
 * container URL (e.g. https://localhost:8080), so we must trust the
 * canonical `NEXTAUTH_URL` env var first, then the proxy headers, and only
 * fall back to `request.url` as a last resort.
 */
function resolveOrigin(request: Request): string {
  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      /* fall through */
    }
  }
  // Proxy headers: take the first segment (closest to the client) when
  // load balancers chain values like "https,http".
  const protoRaw = request.headers.get("x-forwarded-proto");
  const proto = protoRaw ? protoRaw.split(",")[0].trim() : null;
  const hostRaw = request.headers.get("x-forwarded-host");
  const host = hostRaw ? hostRaw.split(",")[0].trim() : null;
  if (host) {
    return `${proto === "https" ? "https" : "http"}://${host}`;
  }
  // RFC 7239 Forwarded header fallback.
  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    const fHost = /host=([^;,\s]+)/i.exec(forwarded)?.[1]?.replace(/"/g, "");
    const fProto = /proto=([^;,\s]+)/i.exec(forwarded)?.[1]?.replace(/"/g, "");
    if (fHost) {
      return `${fProto === "https" ? "https" : "http"}://${fHost}`;
    }
  }
  return new URL(request.url).origin;
}
