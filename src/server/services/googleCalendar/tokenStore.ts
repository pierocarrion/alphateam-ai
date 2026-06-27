import { db } from "@/server/lib/db";
import { account } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_SEC = 60;

export interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: number; // epoch seconds
  scope: string | null;
}

export interface GoogleAccountRow {
  userId: string;
  providerAccountId: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
}

/**
 * Returns the Google OAuth account record for a user, or null if they have
 * not connected Google Calendar yet.
 */
export async function getGoogleAccount(
  userId: string
): Promise<GoogleAccountRow | null> {
  const accountRow = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.provider, "google")),
    columns: {
      userId: true,
      providerAccountId: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });
  return accountRow ?? null;
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const account = await getGoogleAccount(userId);
  return !!account && !!account.refresh_token;
}

/**
 * Removes the Google link for a user. Returns true if something was deleted.
 */
export async function disconnectGoogle(userId: string): Promise<boolean> {
  const deleted = await db
    .delete(account)
    .where(and(eq(account.userId, userId), eq(account.provider, "google")))
    .returning({ id: account.id });
  return deleted.length > 0;
}

interface RefreshResult {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function refreshWithRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<RefreshResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`google token refresh failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as RefreshResult;
}

/**
 * Returns a valid access token for the user, refreshing it with the stored
 * refresh token when it is about to expire. Throws if Google is not connected
 * or the credentials are missing.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  const acct = await getGoogleAccount(userId);
  if (!acct || !acct.refresh_token) {
    throw new Error("Google Calendar is not connected.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = acct.expires_at ?? 0;

  if (acct.access_token && expiresAt - nowSec > EXPIRY_SKEW_SEC) {
    return acct.access_token;
  }

  const refreshed = await refreshWithRefreshToken(
    clientId,
    clientSecret,
    acct.refresh_token
  );

  const newExpiresAt = nowSec + (refreshed.expires_in ?? 3600);

  await db
    .update(account)
    .set({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      ...(refreshed.refresh_token
        ? { refresh_token: refreshed.refresh_token }
        : {}),
      ...(refreshed.scope ? { scope: refreshed.scope } : {}),
    })
    .where(
      and(
        eq(account.provider, "google"),
        eq(account.providerAccountId, acct.providerAccountId)
      )
    );

  return refreshed.access_token;
}
