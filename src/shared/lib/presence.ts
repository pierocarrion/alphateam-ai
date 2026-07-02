import type { PresenceStatus } from "@/shared/ui";

const PRESENCE_CYCLE: PresenceStatus[] = ["online", "online", "away", "busy", "online", "offline"];

const TIMEZONES = [
  "America/Lima (GMT-5)",
  "America/Mexico_City (GMT-6)",
  "America/Bogota (GMT-5)",
  "America/Argentina/Buenos_Aires (GMT-3)",
  "Europe/Madrid (GMT+1)",
  "America/Santiago (GMT-4)",
  "America/Caracas (GMT-4)",
  "UTC",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function presenceFromUserId(
  userId: string,
  membershipStatus?: string | null
): PresenceStatus {
  if (membershipStatus === "invited" || membershipStatus === "inactive") {
    return "offline";
  }
  return PRESENCE_CYCLE[hashString(userId) % PRESENCE_CYCLE.length];
}

export function timezoneFromUserId(userId: string): string {
  return TIMEZONES[hashString(userId) % TIMEZONES.length];
}
