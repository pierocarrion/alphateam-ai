/**
 * Centralized SEO / site configuration.
 *
 * Single source of truth for the canonical site URL so that `metadataBase`,
 * `sitemap.ts`, `robots.ts` and structured data never drift apart.
 *
 * Precedence:
 *   1. SITE_URL  (dedicated prod URL, e.g. https://alphalead.space)
 *   2. NEXTAUTH_URL  (kept as fallback for backward compatibility)
 *   3. https://alphalead.space  (safe prod default — never localhost in prod)
 */

const FALLBACK_PROD_URL = "https://alphalead.space";

function resolveSiteUrl(): string {
  const fromEnv =
    process.env.SITE_URL ??
    process.env.NEXTAUTH_URL ??
    FALLBACK_PROD_URL;
  return fromEnv.replace(/\/$/, "");
}

export const siteUrl = resolveSiteUrl();

export const siteName = "AlphaLead AI";

export const siteDescription =
  "A gentle, anti-guilt productivity companion for teams. Alpha detects procrastination in team chat, shrinks tasks into 2-minute starts, and gives leaders private insights — without shame.";

export const siteKeywords = [
  "productivity",
  "team productivity",
  "anti-procrastination",
  "AI teammate",
  "team chat AI",
  "task detection",
  "focus app",
  "burnout prevention",
  "crew management",
  "AlphaLead AI",
];

export const siteLocale = "en_US";

/** Absolute URL helper. */
export function absoluteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}
