import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { jsonError } from "@/server/lib/apiErrors";
import { suggestMethodology } from "@/server/lib/projectSettingsAi";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await request.json().catch(() => null)) as {
      description?: string;
      industry?: string | null;
      category?: string | null;
    } | null;

    const description = (body?.description ?? "").toString();
    const industry = body?.industry ? String(body.industry) : null;
    const category = body?.category ? String(body.category) : null;

    if (description.trim().length < 8) {
      return NextResponse.json(
        { error: "Describe tu objetivo para poder sugerir." },
        { status: 422 }
      );
    }

    const result = await suggestMethodology({ description, industry, category });
    // AI failures are not validation errors. Return 200 with no suggestion so
    // the client can gracefully fall back to its rule-based recommendation
    // instead of surfacing a scary 422 in the console / network tab.
    if (!result.ok || !result.data) {
      return NextResponse.json({ suggestion: null });
    }
    return NextResponse.json({ suggestion: result.data });
  } catch (error) {
    return jsonError(error);
  }
}
