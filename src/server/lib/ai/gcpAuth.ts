import { GoogleAuth } from "google-auth-library";

/**
 * Centralized GCP auth helper for the AI layer.
 *
 * Used to route partner models (e.g. OpenAI text-embedding-3-small) through
 * Vertex AI Model Garden's OpenAI-compatible endpoint, so the whole AI stack
 * (Gemini chat + Model Garden embeddings) is billed and authenticated through
 * a single GCP project via Application Default Credentials.
 *
 * Scope: cloud-platform (covers Vertex AI / aiplatform.googleapis.com).
 */
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  }
  return cachedAuth;
}

/**
 * Returns a short-lived OAuth2 access token usable as
 * `Authorization: Bearer <token>` against Vertex AI Model Garden endpoints.
 * The underlying GoogleAuth caches and auto-refreshes the token.
 */
export async function getGcpAccessToken(): Promise<string> {
  const client = await getAuth().getClient();
  const token = await client.getAccessToken();
  if (!token) {
    throw new Error("Could not obtain a GCP access token (check Application Default Credentials)");
  }
  // token may be string or { token, expiresOn }; normalize to string.
  const value = typeof token === "string" ? token : token?.token;
  if (!value) {
    throw new Error("Could not obtain a GCP access token (check Application Default Credentials)");
  }
  return value;
}

/** Test-only: reset the cached auth client. */
export function __resetGcpAuth(): void {
  cachedAuth = null;
}
