import { getValidAccessToken } from "./tokenStore";

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

export interface BusyInterval {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

interface FreeBusyResponse {
  calendars?: Record<
    string,
    { busy?: Array<{ start: string; end: string }> }
  >;
}

const ONE_MINUTE = 60 * 1000;

interface CacheEntry {
  key: string;
  value: BusyInterval[];
  expiresAt: number;
}

let cache: CacheEntry | null = null;

function cacheKey(userId: string, from: Date, to: Date): string {
  return `${userId}|${from.getTime()}|${to.getTime()}`;
}

function readCache(key: string): BusyInterval[] | null {
  if (!cache) return null;
  if (cache.key !== key) return null;
  if (Date.now() > cache.expiresAt) return null;
  return cache.value;
}

function writeCache(key: string, value: BusyInterval[]): void {
  cache = { key, value, expiresAt: Date.now() + ONE_MINUTE };
}

/**
 * Fetches the busy intervals for a single user's primary calendar within
 * [from, to]. Uses a short-lived in-memory cache so repeated lookups (e.g.
 * when computing a shared slot) don't re-hit Google.
 *
 * Only busy/free is ever read — event titles and details are intentionally
 * never requested, to respect each person's privacy.
 */
export async function getBusyIntervals(
  userId: string,
  from: Date,
  to: Date
): Promise<BusyInterval[]> {
  const key = cacheKey(userId, from, to);
  const cached = readCache(key);
  if (cached) return cached;

  const accessToken = await getValidAccessToken(userId);

  const body = {
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    items: [{ id: "primary" }],
  };

  const res = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`google freebusy failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as FreeBusyResponse;
  const busy = data.calendars?.primary?.busy ?? [];

  const intervals: BusyInterval[] = busy
    .map((b) => ({ start: b.start, end: b.end }))
    .filter((b) => b.start && b.end)
    .sort((a, b) => a.start.localeCompare(b.start));

  writeCache(key, intervals);
  return intervals;
}

/**
 * Convenience: returns true if the user has any busy interval overlapping
 * [from, to]. Used for quick availability checks.
 */
export async function isBusy(
  userId: string,
  from: Date,
  to: Date
): Promise<boolean> {
  const intervals = await getBusyIntervals(userId, from, to);
  const f = from.getTime();
  const t = to.getTime();
  return intervals.some((i) => {
    const s = new Date(i.start).getTime();
    const e = new Date(i.end).getTime();
    return s < t && e > f;
  });
}
