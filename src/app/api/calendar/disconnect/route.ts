import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { disconnectGoogle } from "@/server/services/googleCalendar";
import { jsonError } from "@/server/lib/apiErrors";

/**
 * Removes the Google Calendar link (deletes the stored OAuth account and its
 * tokens). The user can re-connect at any time.
 */
export async function DELETE() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const removed = await disconnectGoogle(auth.user.id);
    return NextResponse.json({ ok: true, disconnected: removed });
  } catch (error) {
    return jsonError(error);
  }
}
