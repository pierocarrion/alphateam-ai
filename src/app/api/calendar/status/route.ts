import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { isGoogleConnected } from "@/server/services/googleCalendar";
import { jsonError } from "@/server/lib/apiErrors";

/**
 * Returns whether the signed-in user has connected their Google Calendar.
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const connected = await isGoogleConnected(auth.user.id);
    return NextResponse.json({ connected });
  } catch (error) {
    return jsonError(error);
  }
}
